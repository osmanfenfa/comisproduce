"""
"For you" feed: show each post first to the people on the other side of the same category.

  - A SELL post for cassava goes first to people who NEED cassava.
  - A WANTED post for cassava goes first to people who SELL cassava.

What someone needs or sells is learned from what they do (MarketInterest rows). Every
action adds points; points halve every 30 days so current needs beat old ones.

feed_score = 5.0 * match      how strongly the viewer needs / sells this category (0..1)
           + 2.0 * nearby     same district as the viewer
           + 1.0 * fresh      newer posts first (halves every 3 days)
           + 0.5 * popular    likes, comments, offers (capped)
           + 1.0 * trusted    ID-verified member or a buying station
           - penalties        own post, fulfilled post
Every 5th place goes to the best post outside the viewer's interests, so new
categories and new sellers still get seen.
"""
import logging
import math
import uuid
from datetime import datetime
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.market import (
    Listing, ListingKind, ListingStatus, MarketInterest, Offer, OfferStatus,
    ListingLike, ListingSave, ListingComment,
)

logger = logging.getLogger("comis.interests")

NEEDS = "needs"
SELLS = "sells"

# Points per action
POINTS = {
    "post": 10.0,          # posted a listing in this category (sell -> sells, wanted -> needs)
    "offer": 8.0,          # made an offer: on a sell post -> needs, on a wanted post -> sells
    "deal": 10.0,          # an offer was accepted (both sides)
    "save": 4.0,
    "comment": 2.0,
    "like": 1.0,
    "view": 0.5,           # opened the post (counted once a day per post)
}
HALF_LIFE_DAYS = 30.0
FULL_MATCH = 10.0          # an interest score this high counts as a full match

DECLARED_FLOOR = 6.0       # a ticked category counts at least this much (enough for alerts)
FRESH_HALF_LIFE_HOURS = 72.0
PENALTY_OWN, PENALTY_SOLD = 3.0, 2.0
EXPLORE_EVERY = 5          # every 5th place: a post outside the viewer's interests
CANDIDATE_POOL = 400       # newest posts considered for ranking; older ones follow by date


def decayed(score: float, updated_at: datetime, now: datetime | None = None) -> float:
    days = max(0.0, ((now or datetime.utcnow()) - updated_at).total_seconds() / 86400)
    return score * 0.5 ** (days / HALF_LIFE_DAYS)


def side_of_post(kind: ListingKind) -> str:
    """What posting this kind of listing says about the poster."""
    return SELLS if kind == ListingKind.sell else NEEDS


def side_of_responder(kind: ListingKind) -> str:
    """What reacting to this kind of listing says about the viewer (the opposite side)."""
    return NEEDS if kind == ListingKind.sell else SELLS


def bump(db: Session, user_id: uuid.UUID, category: str, side: str, points: float) -> None:
    """Add points to one interest. Commits on its own and never breaks the caller's request."""
    now = datetime.utcnow()
    try:
        row = db.query(MarketInterest).filter(
            MarketInterest.user_id == user_id, MarketInterest.category == category,
            MarketInterest.side == side).first()
        if row:
            row.score = decayed(row.score, row.updated_at, now) + points
            row.updated_at = now
        else:
            db.add(MarketInterest(user_id=user_id, category=category, side=side, score=points, updated_at=now))
        db.commit()
    except Exception:      # a race on the unique key, or the table is missing: personalisation is optional
        db.rollback()
        logger.warning("Could not record market interest", exc_info=True)


def record_for_listing(db: Session, user_id: uuid.UUID, listing: Listing, action: str) -> None:
    """A viewer reacted to someone else's post (offer, save, comment, like, view)."""
    if listing.owner_id == user_id:
        return
    bump(db, user_id, listing.category, side_of_responder(listing.kind), POINTS[action])


def effective(row: MarketInterest, now: datetime | None = None) -> float:
    value = decayed(row.score, row.updated_at, now)
    return max(value, DECLARED_FLOOR) if row.declared else value


def interests_of(db: Session, user_id: uuid.UUID) -> dict[tuple[str, str], float]:
    now = datetime.utcnow()
    return {(r.category, r.side): effective(r, now)
            for r in db.query(MarketInterest).filter(MarketInterest.user_id == user_id)}


def weights() -> dict[str, float]:
    from app.core.config import settings
    return {"match": settings.FEED_W_MATCH, "nearby": settings.FEED_W_NEARBY, "fresh": settings.FEED_W_FRESH,
            "popular": settings.FEED_W_POPULAR, "trusted": settings.FEED_W_TRUSTED}


def set_declared(db: Session, user_id: uuid.UUID, buys: list[str], sells: list[str]) -> None:
    """Replace what the member says they buy / sell. Learned scores are kept."""
    wanted = {(c, NEEDS) for c in buys} | {(c, SELLS) for c in sells}
    rows = {(r.category, r.side): r for r in db.query(MarketInterest).filter(MarketInterest.user_id == user_id)}
    now = datetime.utcnow()
    for key, row in rows.items():
        row.declared = key in wanted
    for category, side in wanted - rows.keys():
        db.add(MarketInterest(user_id=user_id, category=category, side=side, score=0.0,
                              updated_at=now, declared=True))
    db.commit()


def matches_now(db: Session, user_id: uuid.UUID, listing: Listing) -> bool:
    """Before recording an offer: did this person already need / sell what the post is about?"""
    row = db.query(MarketInterest).filter(
        MarketInterest.user_id == user_id, MarketInterest.category == listing.category,
        MarketInterest.side == side_of_responder(listing.kind)).first()
    return bool(row) and effective(row) >= 0.2 * FULL_MATCH


# ---------------------------------------------------------------------------
# ranking
# ---------------------------------------------------------------------------

def _popularity(db: Session, ids: list[uuid.UUID]) -> dict[uuid.UUID, float]:
    if not ids:
        return {}
    pop: dict[uuid.UUID, float] = {}
    for model, weight in ((ListingLike, 1.0), (ListingComment, 2.0), (Offer, 3.0)):
        for lid, n in (db.query(model.listing_id, func.count(model.id))
                       .filter(model.listing_id.in_(ids)).group_by(model.listing_id)):
            pop[lid] = pop.get(lid, 0.0) + weight * n
    return pop


def rank(db: Session, listings: list[Listing], viewer_id: uuid.UUID, viewer_district: str | None,
         is_verified) -> list[tuple[Listing, str | None]]:
    """Order listings for this viewer. Returns (listing, reason) where reason is the matched side."""
    if not listings:
        return []
    now = datetime.utcnow()
    mine = interests_of(db, viewer_id)
    pop = _popularity(db, [l.id for l in listings])
    w = weights()

    scored = []
    for l in listings:
        want_side = side_of_responder(l.kind)      # sell post -> do I need it? wanted post -> do I sell it?
        match = min(1.0, mine.get((l.category, want_side), 0.0) / FULL_MATCH)
        nearby = 1.0 if viewer_district and l.district == viewer_district else 0.0
        hours = max(0.0, (now - l.created_at).total_seconds() / 3600)
        fresh = 0.5 ** (hours / FRESH_HALF_LIFE_HOURS)
        popular = min(1.0, math.log1p(pop.get(l.id, 0.0)) / math.log1p(20))
        trusted = 1.0 if is_verified(l.owner) else 0.0
        score = (w["match"] * match + w["nearby"] * nearby + w["fresh"] * fresh
                 + w["popular"] * popular + w["trusted"] * trusted)
        if l.owner_id == viewer_id:
            score -= PENALTY_OWN
        if l.status == ListingStatus.sold:
            score -= PENALTY_SOLD
        reason = want_side if match >= 0.2 and l.owner_id != viewer_id else None
        scored.append((score, l.created_at, l, reason))

    scored.sort(key=lambda s: (s[0], s[1]), reverse=True)
    matched = [s for s in scored if s[3]]
    others = [s for s in scored if not s[3]]
    if not matched:
        return [(s[2], None) for s in scored]

    # Mix: mostly matches, every EXPLORE_EVERY-th place the best remaining other post
    out = []
    mi = oi = 0
    while mi < len(matched) or oi < len(others):
        take_other = (len(out) + 1) % EXPLORE_EVERY == 0 and oi < len(others)
        if take_other or mi >= len(matched):
            out.append(others[oi]); oi += 1
        else:
            out.append(matched[mi]); mi += 1
    return [(s[2], s[3]) for s in out]


# ---------------------------------------------------------------------------
# backfill (migration 0012): learn interests from activity that happened before this feature
# ---------------------------------------------------------------------------

def backfill(conn) -> int:
    """Seed market_interests from existing listings, offers, saves, comments and likes."""
    from sqlalchemy import text
    totals: dict[tuple, float] = {}

    def add(user_id, category, side, pts):
        key = (str(user_id), category, side)
        totals[key] = totals.get(key, 0.0) + pts

    opposite = {"sell": NEEDS, "wanted": SELLS}
    own = {"sell": SELLS, "wanted": NEEDS}
    for owner_id, category, kind in conn.execute(text(
            "SELECT owner_id, category, kind FROM market_listings WHERE status <> 'removed'")):
        add(owner_id, category, own.get(str(kind), SELLS), POINTS["post"])
    for user_id, category, kind, status in conn.execute(text(
            "SELECT o.from_user_id, l.category, l.kind, o.status FROM market_offers o "
            "JOIN market_listings l ON l.id = o.listing_id")):
        pts = POINTS["offer"] + (POINTS["deal"] if str(status) == "accepted" else 0.0)
        add(user_id, category, opposite.get(str(kind), NEEDS), pts)
    for table, action in (("market_saves", "save"), ("market_comments", "comment"), ("market_likes", "like")):
        for user_id, category, kind, owner_id in conn.execute(text(
                f"SELECT t.user_id, l.category, l.kind, l.owner_id FROM {table} t "
                f"JOIN market_listings l ON l.id = t.listing_id")):
            if user_id != owner_id:
                add(user_id, category, opposite.get(str(kind), NEEDS), POINTS[action])

    now = datetime.utcnow()
    rows = [{"id": uuid.uuid4(), "user_id": uuid.UUID(u), "category": c, "side": s, "score": pts, "updated_at": now}
            for (u, c, s), pts in totals.items()]
    if rows:
        # Only the columns that exist at migration 0012 (later migrations add more)
        from sqlalchemy import table, column
        t = table("market_interests", column("id"), column("user_id"), column("category"), column("side"),
                  column("score"), column("updated_at"))
        conn.execute(t.insert(), rows)
    return len(rows)


# ---------------------------------------------------------------------------
# alerts: tell the people who need it (or sell it) when a matching post goes up
# ---------------------------------------------------------------------------

ALERT_MIN_SCORE = 6.0      # a wanted post or an offer counts; a single save or like does not
ALERT_MAX_PEOPLE = 50      # per new post
ALERT_DAILY_CAP = 3        # alerts per member per 24 hours


def match_alerts(db: Session, listing: Listing) -> list:
    """
    Create MarketAlert rows for the members who most need (sell post) or supply (wanted post)
    this category, nearby first. Returns the alerted users. Never raises.
    """
    from datetime import timedelta
    from app.models.market import MarketAlert
    from app.models.user import User, UserRole, UserStatus
    try:
        side = side_of_responder(listing.kind)
        now = datetime.utcnow()
        rows = (db.query(MarketInterest, User).join(User, User.id == MarketInterest.user_id)
                .filter(MarketInterest.category == listing.category, MarketInterest.side == side,
                        MarketInterest.user_id != listing.owner_id,
                        User.status == UserStatus.active,
                        User.role.in_([UserRole.farmer, UserRole.trader,
                                       UserRole.produce_manager, UserRole.produce_secretary]))
                .all())
        people = [(effective(i, now), u) for i, u in rows]
        people = [(s, u) for s, u in people if s >= ALERT_MIN_SCORE]
        if not people:
            return []
        # Nearby first, then the strongest need
        people.sort(key=lambda p: (p[1].district == listing.district, p[0]), reverse=True)

        ids = [u.id for _, u in people]
        since = now - timedelta(hours=24)
        recent = dict(db.query(MarketAlert.user_id, func.count(MarketAlert.id))
                      .filter(MarketAlert.user_id.in_(ids), MarketAlert.created_at >= since)
                      .group_by(MarketAlert.user_id).all())
        chosen = [u for _, u in people if recent.get(u.id, 0) < ALERT_DAILY_CAP][:ALERT_MAX_PEOPLE]
        for u in chosen:
            db.add(MarketAlert(user_id=u.id, listing_id=listing.id, side=side, created_at=now))
        db.commit()
        return chosen
    except Exception:
        db.rollback()
        logger.warning("Could not create market alerts", exc_info=True)
        return []


def alert_sms_text(listing: Listing, category_label: str) -> str:
    what = "for sale" if listing.kind == ListingKind.sell else "wanted"
    qty = f" - {listing.quantity:g} {listing.unit}" if listing.quantity else ""
    return f"COMIS Market: {category_label} {what} in {listing.district}{qty}. Open COMIS Market to see it."
