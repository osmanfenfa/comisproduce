"""
COMIS Market: farmers, traders and buying stations post products and respond with offers.

Who can do what
  - farmer / trader (signup here, active immediately): browse, post sell or wanted
    listings with photos and one short video, make and answer offers.
  - produce_manager / produce_secretary: the same, so stations can source supply.
  - system_admin: browse and moderate (remove listings, resolve reports).
  - Phone numbers are shared only between the two sides of an accepted offer.

Nothing here touches the buying-station tables.
"""
import hashlib
import hmac
import os
import secrets
import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, selectinload
from app.db.session import get_db
from app.core.permissions import require_role
from app.core.security import hash_password
from app.core.locations import normalize_district
from app.core.rate_limit import limiter, client_ip, too_many_requests
from app.models.user import User, UserRole, UserStatus
from app.models.market import (
    Listing, ListingMedia, ListingKind, ListingStatus, Offer, OfferStatus, ListingReport,
    ListingLike, ListingSave, ListingComment, CommentLike,
)
from app.schemas.user import Token
from app.schemas.market import (
    CATEGORIES, UNITS, MarketSignup, PhoneCodeConfirm, MarketProfileOut, MarketProfileUpdate,
    ListingIn, ListingOut, ListingStatusUpdate, MediaOut, OwnerOut, OfferIn, OfferOut, ReportIn, ReportOut,
    CommentIn, CommentOut, ReactionOut,
    IdExtractOut, IdConfirmIn, VerificationOut, VerificationReject,
)
from fastapi import Form
from fastapi.responses import FileResponse
from app.services import id_document
from app.services.avatars import avatar_url
from app.services.audit import log_action
from app.services.phone import normalize_phone, phone_key, looks_like_phone, InvalidPhone
from app.services.sms import send_sms, sms_available, SmsUnavailable
from app.services.media_storage import storage, MediaRejected

router = APIRouter()

MARKET_TRADERS = require_role(UserRole.farmer, UserRole.trader, UserRole.produce_manager,
                              UserRole.produce_secretary)
MARKET_VIEWERS = require_role(UserRole.farmer, UserRole.trader, UserRole.produce_manager,
                              UserRole.produce_secretary, UserRole.system_admin)
ADMIN_ONLY = require_role(UserRole.system_admin)

MAX_PHOTOS = 6
MAX_VIDEOS = 1
PAGE_SIZE = 20
OTP_TTL = timedelta(minutes=10)
OTP_MAX_ATTEMPTS = 5


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _user(db: Session, current: dict) -> User:
    user = db.query(User).filter(User.id == current["id"]).first()
    if not user or user.status != UserStatus.active:
        raise HTTPException(status_code=403, detail="Account is not active.")
    return user


def _is_verified(u: User) -> bool:
    return u.phone_verified_at is not None and u.id_status == "verified"


def _owner_out(u: User) -> OwnerOut:
    return OwnerOut(
        verified=_is_verified(u),
        avatar_url=avatar_url(u),
        id=u.id, name=u.name, role=u.role.value,
        # Station staff appear under their business / station name
        business_name=u.business_name or (u.station_name if u.role == UserRole.produce_secretary else None),
        district=u.district, phone_verified=u.phone_verified_at is not None,
    )


def _phone_of(u: User) -> str | None:
    if u.role in (UserRole.farmer, UserRole.trader):
        return u.contact
    return u.phone_number or (u.contact if "@" not in (u.contact or "") else None)


def _listing_out(l: Listing, current: dict, my_offer: OfferStatus | None = None,
                 pending: int | None = None) -> ListingOut:
    is_mine = l.owner_id == current["id"]
    return ListingOut(
        id=l.id, kind=l.kind, category=l.category, category_label=CATEGORIES.get(l.category, l.category),
        title=l.title, description=l.description, quantity=l.quantity, unit=l.unit,
        price=float(l.price) if l.price is not None else None, negotiable=l.negotiable,
        district=l.district, chiefdom=l.chiefdom, available_from=l.available_from,
        status=l.status, created_at=l.created_at, owner=_owner_out(l.owner),
        media=[MediaOut(id=m.id, kind=m.kind, url=storage.url(m.path)) for m in l.media],
        is_mine=is_mine, my_offer_status=my_offer, pending_offers=pending if is_mine else None,
    )


def _with_social(db: Session, outs: list[ListingOut], current: dict) -> list[ListingOut]:
    """Fill like/comment counts and the viewer's like/save state (4 queries for the whole page)."""
    ids = [o.id for o in outs]
    if not ids:
        return outs
    likes = dict(db.query(ListingLike.listing_id, func.count(ListingLike.id))
                 .filter(ListingLike.listing_id.in_(ids)).group_by(ListingLike.listing_id).all())
    comments = dict(db.query(ListingComment.listing_id, func.count(ListingComment.id))
                    .filter(ListingComment.listing_id.in_(ids)).group_by(ListingComment.listing_id).all())
    liked = {r[0] for r in db.query(ListingLike.listing_id).filter(
        ListingLike.listing_id.in_(ids), ListingLike.user_id == current["id"])}
    saved = {r[0] for r in db.query(ListingSave.listing_id).filter(
        ListingSave.listing_id.in_(ids), ListingSave.user_id == current["id"])}
    for o in outs:
        o.like_count = likes.get(o.id, 0)
        o.comment_count = comments.get(o.id, 0)
        o.liked_by_me = o.id in liked
        o.saved_by_me = o.id in saved
    return outs


def _offer_out(o: Offer, current: dict) -> OfferOut:
    listing = o.listing
    counterpart = listing.owner if o.from_user_id == current["id"] else o.from_user
    return OfferOut(
        id=o.id, listing_id=listing.id, listing_title=listing.title, listing_kind=listing.kind,
        unit=listing.unit, quantity=o.quantity, price=float(o.price) if o.price is not None else None,
        message=o.message, status=o.status, created_at=o.created_at, responded_at=o.responded_at,
        from_user=_owner_out(o.from_user), listing_owner=_owner_out(listing.owner),
        counterpart_phone=_phone_of(counterpart) if o.status == OfferStatus.accepted else None,
    )


def _district(value: str | None) -> str:
    d = normalize_district(value)
    if not d:
        raise HTTPException(status_code=400, detail="Choose a valid district.")
    return d


def _check_listing_input(payload: ListingIn) -> None:
    if payload.category not in CATEGORIES:
        raise HTTPException(status_code=400, detail="Unknown category.")
    if payload.unit not in UNITS:
        raise HTTPException(status_code=400, detail=f"Unit must be one of: {', '.join(UNITS)}.")


def _load_listing(db: Session, listing_id: uuid.UUID) -> Listing:
    listing = (db.query(Listing).options(selectinload(Listing.media), selectinload(Listing.owner))
               .filter(Listing.id == listing_id).first())
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    return listing


def _own_listing(db: Session, listing_id: uuid.UUID, current: dict) -> Listing:
    listing = _load_listing(db, listing_id)
    if listing.owner_id != current["id"]:
        raise HTTPException(status_code=403, detail="Only the person who posted this listing can change it.")
    if listing.status == ListingStatus.removed:
        raise HTTPException(status_code=403, detail="This listing was removed by a moderator.")
    return listing


# ---------------------------------------------------------------------------
# accounts
# ---------------------------------------------------------------------------

@router.get("/meta")
def market_meta():
    """Categories, units and districts for the forms (public)."""
    from app.core.locations import DISTRICTS
    return {
        "categories": [{"key": k, "label": v} for k, v in CATEGORIES.items()],
        "units": UNITS,
        "districts": DISTRICTS,
    }


@router.post("/signup", response_model=Token, status_code=201)
def market_signup(payload: MarketSignup, request: Request, db: Session = Depends(get_db)):
    """Farmers and traders sign up with a phone number and are active immediately."""
    if limiter.check_and_hit(f"market-signup:ip:{client_ip(request)}", 5, 15 * 60):
        raise too_many_requests(15 * 60)
    if not payload.terms_accepted:
        raise HTTPException(status_code=400, detail="You must agree to the Terms of Service to sign up.")
    try:
        phone = normalize_phone(payload.phone)
    except InvalidPhone as e:
        raise HTTPException(status_code=400, detail=str(e))
    district = _district(payload.district)

    key = phone_key(phone)
    for contact, phone_number, role in db.query(User.contact, User.phone_number, User.role).filter(
        or_(User.contact.like(f"%{key[-4:]}%"), User.phone_number.like(f"%{key[-4:]}%"))
    ):
        # Only compare real phone numbers (an email like "mgr12345678@x.com" must not match)
        numbers = [n for n in (contact, phone_number) if looks_like_phone(n)]
        if key in {phone_key(n) for n in numbers}:
            if role in (UserRole.farmer, UserRole.trader):
                detail = (f"This phone number already has a {role.value} account. "
                          "Log in with it (use Forgot password if you don't remember the password).")
            else:
                detail = ("This phone number is already used by a buying-station staff account, which logs in "
                          "with its email. Use a different phone number for a farmer or trader account.")
            raise HTTPException(status_code=409, detail=detail)

    user = User(
        name=payload.name.strip(),
        contact=phone,
        phone_number=phone,
        password_hash=hash_password(payload.password),
        role=UserRole(payload.account_type),
        status=UserStatus.active,
        is_active=True,
        district=district,
        chiefdom=(payload.chiefdom or "").strip() or None,
        business_name=(payload.business_name or "").strip() or None if payload.account_type == "trader" else None,
    )
    db.add(user)
    db.flush()
    log_action(db, user.id, user.role.value, "market_signup", "User", user.id,
               new_value={"role": user.role.value, "district": district}, commit=False)
    db.commit()
    db.refresh(user)

    from app.api.v1.endpoints.auth import _issue_token
    return _issue_token(user, db)


@router.get("/me", response_model=MarketProfileOut)
def my_profile(db: Session = Depends(get_db), current=Depends(MARKET_VIEWERS)):
    u = _user(db, current)
    return MarketProfileOut(
        id=u.id, name=u.name, role=u.role.value, phone=_phone_of(u), business_name=u.business_name,
        district=u.district, chiefdom=u.chiefdom, phone_verified=u.phone_verified_at is not None,
        id_status=u.id_status or "none", id_doc_type=u.id_doc_type, id_doc_number=u.id_doc_number,
        id_reject_reason=u.id_reject_reason, verified=_is_verified(u), avatar_url=avatar_url(u),
    )


@router.put("/me", response_model=MarketProfileOut)
def update_profile(payload: MarketProfileUpdate, db: Session = Depends(get_db), current=Depends(MARKET_TRADERS)):
    u = _user(db, current)
    if u.role not in (UserRole.farmer, UserRole.trader):
        raise HTTPException(status_code=403, detail="Station accounts are edited under Edit Profile.")
    data = payload.model_dump(exclude_unset=True)
    if "district" in data:
        data["district"] = _district(data["district"])
    for field, value in data.items():
        setattr(u, field, value.strip() if isinstance(value, str) else value)
    db.commit()
    return my_profile(db, current)


@router.post("/me/verify-phone/send")
def send_phone_code(request: Request, db: Session = Depends(get_db),
                    current=Depends(require_role(UserRole.farmer, UserRole.trader))):
    u = _user(db, current)
    if u.phone_verified_at:
        return {"message": "Your phone number is already verified."}
    if not sms_available():
        raise HTTPException(status_code=503, detail="Phone verification by SMS is not available yet.")
    if limiter.check_and_hit(f"otp-send:{u.id}", 3, 15 * 60):
        raise too_many_requests(15 * 60)

    code = f"{secrets.randbelow(900000) + 100000}"
    u.phone_otp_hash = hashlib.sha256(code.encode()).hexdigest()
    u.phone_otp_expires_at = datetime.utcnow() + OTP_TTL
    u.phone_otp_attempts = 0
    try:
        send_sms(u.contact, f"Your COMIS verification code is {code}. It expires in 10 minutes.")
    except SmsUnavailable as e:
        raise HTTPException(status_code=503, detail=str(e))
    db.commit()
    return {"message": "We sent a 6-digit code to your phone."}


@router.post("/me/verify-phone/confirm")
def confirm_phone_code(payload: PhoneCodeConfirm, db: Session = Depends(get_db),
                       current=Depends(require_role(UserRole.farmer, UserRole.trader))):
    u = _user(db, current)
    if u.phone_verified_at:
        return {"message": "Your phone number is already verified."}
    valid = (u.phone_otp_hash and u.phone_otp_expires_at and u.phone_otp_expires_at > datetime.utcnow())
    if valid and hmac.compare_digest(u.phone_otp_hash, hashlib.sha256(payload.code.encode()).hexdigest()):
        u.phone_verified_at = datetime.utcnow()
        u.phone_otp_hash = None
        u.phone_otp_expires_at = None
        db.commit()
        return {"message": "Phone number verified."}
    if valid:
        u.phone_otp_attempts = (u.phone_otp_attempts or 0) + 1
        if u.phone_otp_attempts >= OTP_MAX_ATTEMPTS:
            u.phone_otp_hash = None
            u.phone_otp_expires_at = None
        db.commit()
    raise HTTPException(status_code=400, detail="Wrong or expired code. Request a new one.")


# ---------------------------------------------------------------------------
# identity document (National ID / passport)
# ---------------------------------------------------------------------------

MARKET_MEMBERS = require_role(UserRole.farmer, UserRole.trader)


@router.post("/me/id-document", response_model=IdExtractOut)
async def upload_id_document(
    doc_type: str = Form(..., pattern="^(nin|passport)$"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current=Depends(MARKET_MEMBERS),
):
    """Upload a photo of the National ID card or passport; the system reads the number from it."""
    u = _user(db, current)
    if u.id_status == "verified":
        raise HTTPException(status_code=400, detail="Your identity is already verified.")
    if limiter.check_and_hit(f"id-upload:{u.id}", 10, 60 * 60):
        raise too_many_requests(60 * 60)
    try:
        rel = await id_document.save_private(file, u.id)
    except id_document.IdDocumentRejected as e:
        raise HTTPException(status_code=400, detail=str(e))

    extraction = id_document.extract_number(doc_type, rel)
    id_document.delete_private(u.id_doc_path)       # replace any earlier photo
    u.id_doc_type = doc_type
    u.id_doc_path = rel
    u.id_doc_number_read = extraction.number
    u.id_doc_number = None
    u.id_status = "draft"
    u.id_reject_reason = None
    db.commit()
    return IdExtractOut(doc_type=doc_type, number_read=extraction.number, method=extraction.method,
                        ocr_available=extraction.ocr_available, status=u.id_status)


@router.post("/me/id-document/confirm", response_model=MarketProfileOut)
def confirm_id_document(payload: IdConfirmIn, db: Session = Depends(get_db), current=Depends(MARKET_MEMBERS)):
    """Confirm (or correct) the number the system read; sends it for review."""
    u = _user(db, current)
    if u.id_status != "draft" or not u.id_doc_path:
        raise HTTPException(status_code=400, detail="Upload a photo of your document first.")
    number = id_document.normalize_number(payload.doc_number)
    if not 5 <= len(number) <= 20:
        raise HTTPException(status_code=400, detail="Enter the number exactly as it appears on the document.")
    taken = db.query(User.id).filter(
        User.id != u.id, User.id_doc_type == u.id_doc_type, User.id_doc_number == number,
        User.id_status.in_(["pending", "verified"]),
    ).first()
    if taken:
        raise HTTPException(status_code=409, detail="This document is already used to verify another account.")
    u.id_doc_number = number
    u.id_status = "pending"
    u.id_submitted_at = datetime.utcnow()
    db.commit()
    return my_profile(db, current)


@router.get("/me/id-document/image")
def my_id_document_image(db: Session = Depends(get_db), current=Depends(MARKET_MEMBERS)):
    u = _user(db, current)
    if not u.id_doc_path or not os.path.isfile(id_document.private_path(u.id_doc_path)):
        raise HTTPException(status_code=404, detail="No document uploaded.")
    return FileResponse(id_document.private_path(u.id_doc_path), headers={"Cache-Control": "private, no-store"})


def _verification_out(u: User) -> VerificationOut:
    return VerificationOut(
        user_id=u.id, name=u.name, role=u.role.value, phone=_phone_of(u),
        phone_verified=u.phone_verified_at is not None, district=u.district,
        doc_type=u.id_doc_type, doc_number=u.id_doc_number, number_read=u.id_doc_number_read,
        number_edited=bool(u.id_doc_number and u.id_doc_number != u.id_doc_number_read),
        status=u.id_status, submitted_at=u.id_submitted_at, reject_reason=u.id_reject_reason,
    )


@router.get("/admin/verifications", response_model=list[VerificationOut])
def list_verifications(status: str = Query("pending", pattern="^(pending|verified|rejected)$"),
                       db: Session = Depends(get_db), current=Depends(ADMIN_ONLY)):
    users = (db.query(User).filter(User.id_status == status)
             .order_by(User.id_submitted_at.desc()).limit(200).all())
    return [_verification_out(u) for u in users]


def _member(db: Session, user_id: uuid.UUID) -> User:
    u = db.query(User).filter(User.id == user_id, User.role.in_([UserRole.farmer, UserRole.trader])).first()
    if not u:
        raise HTTPException(status_code=404, detail="Member not found")
    return u


@router.get("/admin/verifications/{user_id}/image")
def verification_image(user_id: uuid.UUID, db: Session = Depends(get_db), current=Depends(ADMIN_ONLY)):
    u = _member(db, user_id)
    if not u.id_doc_path or not os.path.isfile(id_document.private_path(u.id_doc_path)):
        raise HTTPException(status_code=404, detail="No document uploaded.")
    return FileResponse(id_document.private_path(u.id_doc_path), headers={"Cache-Control": "private, no-store"})


@router.post("/admin/verifications/{user_id}/{decision}", response_model=VerificationOut)
def review_verification(user_id: uuid.UUID, decision: str, payload: VerificationReject | None = None,
                        db: Session = Depends(get_db), current=Depends(ADMIN_ONLY)):
    u = _member(db, user_id)
    if u.id_status != "pending":
        raise HTTPException(status_code=400, detail="Only submitted documents can be reviewed.")
    if decision == "approve":
        u.id_status = "verified"
        u.id_reject_reason = None
    elif decision == "reject":
        if not payload:
            raise HTTPException(status_code=400, detail="Give a reason so the member can fix it.")
        u.id_status = "rejected"
        u.id_reject_reason = payload.reason.strip()
    else:
        raise HTTPException(status_code=404, detail="Unknown decision")
    u.id_reviewed_at = datetime.utcnow()
    u.id_reviewed_by = current["id"]
    log_action(db, current["id"], current["role"], f"id_{decision}", "User", u.id,
               new_value={"doc_type": u.id_doc_type, "doc_number": u.id_doc_number}, commit=False)
    db.commit()
    return _verification_out(u)


# ---------------------------------------------------------------------------
# listings
# ---------------------------------------------------------------------------

@router.get("/listings", response_model=list[ListingOut])
def browse_listings(
    kind: ListingKind | None = None,
    category: str | None = None,
    district: str | None = None,
    q: str | None = Query(default=None, max_length=80),
    saved: bool = False,
    page: int = Query(default=1, ge=1, le=500),
    db: Session = Depends(get_db),
    current=Depends(MARKET_VIEWERS),
):
    # Fulfilled (sold) posts stay in the feed, marked as such: people can still like,
    # comment and share them, but offers are closed. Closed/removed posts drop out.
    query = (db.query(Listing).options(selectinload(Listing.media), selectinload(Listing.owner))
             .filter(Listing.status.in_([ListingStatus.active, ListingStatus.sold])))
    if saved:
        query = query.join(ListingSave, ListingSave.listing_id == Listing.id).filter(
            ListingSave.user_id == current["id"])
    if kind:
        query = query.filter(Listing.kind == kind)
    if category:
        query = query.filter(Listing.category == category)
    if district:
        query = query.filter(Listing.district == normalize_district(district))
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(or_(Listing.title.ilike(like), Listing.description.ilike(like)))
    listings = (query.order_by(Listing.created_at.desc())
                .offset((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).all())

    mine = {o.listing_id: o.status for o in db.query(Offer).filter(
        Offer.from_user_id == current["id"], Offer.listing_id.in_([l.id for l in listings] or [uuid.uuid4()]))}
    return _with_social(db, [_listing_out(l, current, mine.get(l.id)) for l in listings], current)


@router.get("/my-listings", response_model=list[ListingOut])
def my_listings(db: Session = Depends(get_db), current=Depends(MARKET_TRADERS)):
    listings = (db.query(Listing).options(selectinload(Listing.media), selectinload(Listing.owner))
                .filter(Listing.owner_id == current["id"]).order_by(Listing.created_at.desc()).all())
    pending = dict(db.query(Offer.listing_id, func.count(Offer.id)).filter(
        Offer.status == OfferStatus.pending,
        Offer.listing_id.in_([l.id for l in listings] or [uuid.uuid4()]),
    ).group_by(Offer.listing_id).all())
    return _with_social(db, [_listing_out(l, current, pending=pending.get(l.id, 0)) for l in listings], current)


@router.get("/listings/{listing_id}", response_model=ListingOut)
def get_listing(listing_id: uuid.UUID, db: Session = Depends(get_db), current=Depends(MARKET_VIEWERS)):
    listing = _load_listing(db, listing_id)
    if listing.status == ListingStatus.removed and listing.owner_id != current["id"] \
            and current["role"] != UserRole.system_admin.value:
        raise HTTPException(status_code=404, detail="Listing not found")
    my_offer = (db.query(Offer.status).filter(Offer.listing_id == listing.id, Offer.from_user_id == current["id"])
                .order_by(Offer.created_at.desc()).first())
    pending = db.query(func.count(Offer.id)).filter(
        Offer.listing_id == listing.id, Offer.status == OfferStatus.pending).scalar()
    return _with_social(db, [_listing_out(listing, current, my_offer[0] if my_offer else None, pending)], current)[0]


@router.post("/listings", response_model=ListingOut, status_code=201)
def create_listing(payload: ListingIn, db: Session = Depends(get_db), current=Depends(MARKET_TRADERS)):
    _user(db, current)
    if limiter.check_and_hit(f"market-post:{current['id']}", 20, 60 * 60):
        raise too_many_requests(60 * 60)
    _check_listing_input(payload)
    data = payload.model_dump()
    data["district"] = _district(payload.district)
    data["chiefdom"] = (payload.chiefdom or "").strip() or None
    listing = Listing(**data, owner_id=current["id"], status=ListingStatus.active)
    db.add(listing)
    db.commit()
    return _listing_out(_load_listing(db, listing.id), current, pending=0)


@router.put("/listings/{listing_id}", response_model=ListingOut)
def edit_listing(listing_id: uuid.UUID, payload: ListingIn, db: Session = Depends(get_db),
                 current=Depends(MARKET_TRADERS)):
    listing = _own_listing(db, listing_id, current)
    _check_listing_input(payload)
    data = payload.model_dump()
    data["district"] = _district(payload.district)
    data["chiefdom"] = (payload.chiefdom or "").strip() or None
    for field, value in data.items():
        setattr(listing, field, value)
    db.commit()
    return get_listing(listing_id, db, current)


@router.post("/listings/{listing_id}/status", response_model=ListingOut)
def set_listing_status(listing_id: uuid.UUID, payload: ListingStatusUpdate, db: Session = Depends(get_db),
                       current=Depends(MARKET_TRADERS)):
    """Owner marks a listing sold / closed, or reopens it."""
    if payload.status == ListingStatus.removed:
        raise HTTPException(status_code=400, detail="Use Delete to remove your listing.")
    listing = _own_listing(db, listing_id, current)
    listing.status = payload.status
    db.commit()
    return get_listing(listing_id, db, current)


@router.delete("/listings/{listing_id}")
def delete_listing(listing_id: uuid.UUID, db: Session = Depends(get_db), current=Depends(MARKET_TRADERS)):
    listing = _own_listing(db, listing_id, current)
    paths = [m.path for m in listing.media]
    db.delete(listing)
    db.commit()
    for p in paths:
        storage.delete(p)
    return {"message": "Listing deleted."}


@router.post("/listings/{listing_id}/media", response_model=MediaOut, status_code=201)
async def upload_media(listing_id: uuid.UUID, file: UploadFile = File(...), db: Session = Depends(get_db),
                       current=Depends(MARKET_TRADERS)):
    listing = _own_listing(db, listing_id, current)
    try:
        stored = await storage.save(file, f"listings/{listing.id}")
    except MediaRejected as e:
        raise HTTPException(status_code=400, detail=str(e))

    counts = {"photo": 0, "video": 0}
    for m in listing.media:
        counts[m.kind] = counts.get(m.kind, 0) + 1
    limit = MAX_PHOTOS if stored.kind == "photo" else MAX_VIDEOS
    if counts[stored.kind] >= limit:
        storage.delete(stored.path)
        raise HTTPException(status_code=400, detail=f"A listing can have at most {MAX_PHOTOS} photos and {MAX_VIDEOS} video.")

    media = ListingMedia(listing_id=listing.id, kind=stored.kind, path=stored.path,
                         content_type=stored.content_type, size_bytes=stored.size,
                         sort_order=len(listing.media))
    db.add(media)
    db.commit()
    return MediaOut(id=media.id, kind=media.kind, url=storage.url(media.path))


@router.delete("/listings/{listing_id}/media/{media_id}")
def delete_media(listing_id: uuid.UUID, media_id: uuid.UUID, db: Session = Depends(get_db),
                 current=Depends(MARKET_TRADERS)):
    listing = _own_listing(db, listing_id, current)
    media = next((m for m in listing.media if m.id == media_id), None)
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")
    path = media.path
    db.delete(media)
    db.commit()
    storage.delete(path)
    return {"message": "Removed."}


# ---------------------------------------------------------------------------
# feed interactions: like, save, comment
# ---------------------------------------------------------------------------

def _visible_listing(db: Session, listing_id: uuid.UUID) -> Listing:
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing or listing.status == ListingStatus.removed:
        raise HTTPException(status_code=404, detail="Listing not found")
    return listing


def _toggle(db: Session, model, listing_id: uuid.UUID, current: dict, on: bool) -> ReactionOut:
    listing = _visible_listing(db, listing_id)
    row = db.query(model).filter(model.listing_id == listing.id, model.user_id == current["id"]).first()
    if on and not row:
        db.add(model(listing_id=listing.id, user_id=current["id"]))
    elif not on and row:
        db.delete(row)
    try:
        db.commit()
    except Exception:     # a double tap raced the unique constraint: the reaction already exists
        db.rollback()
    count = db.query(func.count(model.id)).filter(model.listing_id == listing.id).scalar()
    return ReactionOut(active=on, count=count)


@router.put("/listings/{listing_id}/like", response_model=ReactionOut)
def like(listing_id: uuid.UUID, db: Session = Depends(get_db), current=Depends(MARKET_TRADERS)):
    return _toggle(db, ListingLike, listing_id, current, True)


@router.delete("/listings/{listing_id}/like", response_model=ReactionOut)
def unlike(listing_id: uuid.UUID, db: Session = Depends(get_db), current=Depends(MARKET_TRADERS)):
    return _toggle(db, ListingLike, listing_id, current, False)


@router.put("/listings/{listing_id}/save", response_model=ReactionOut)
def save_post(listing_id: uuid.UUID, db: Session = Depends(get_db), current=Depends(MARKET_TRADERS)):
    return _toggle(db, ListingSave, listing_id, current, True)


@router.delete("/listings/{listing_id}/save", response_model=ReactionOut)
def unsave_post(listing_id: uuid.UUID, db: Session = Depends(get_db), current=Depends(MARKET_TRADERS)):
    return _toggle(db, ListingSave, listing_id, current, False)


def _comment_out(c: ListingComment, listing: Listing, current: dict,
                 likes: int = 0, liked: bool = False) -> CommentOut:
    can_delete = (c.user_id == current["id"] or listing.owner_id == current["id"]
                  or current["role"] == UserRole.system_admin.value)
    return CommentOut(id=c.id, listing_id=c.listing_id, body=c.body, created_at=c.created_at,
                      author=_owner_out(c.author), can_delete=can_delete, parent_id=c.parent_id,
                      like_count=likes, liked_by_me=liked)


@router.get("/listings/{listing_id}/comments", response_model=list[CommentOut])
def list_comments(listing_id: uuid.UUID, db: Session = Depends(get_db), current=Depends(MARKET_VIEWERS)):
    listing = _visible_listing(db, listing_id)
    comments = (db.query(ListingComment).options(selectinload(ListingComment.author))
                .filter(ListingComment.listing_id == listing.id)
                .order_by(ListingComment.created_at.asc()).limit(500).all())
    ids = [c.id for c in comments] or [uuid.uuid4()]
    likes = dict(db.query(CommentLike.comment_id, func.count(CommentLike.id))
                 .filter(CommentLike.comment_id.in_(ids)).group_by(CommentLike.comment_id).all())
    mine = {r[0] for r in db.query(CommentLike.comment_id).filter(
        CommentLike.comment_id.in_(ids), CommentLike.user_id == current["id"])}
    # Flat list, oldest first; replies carry parent_id and the app nests them
    return [_comment_out(c, listing, current, likes.get(c.id, 0), c.id in mine) for c in comments]


@router.post("/listings/{listing_id}/comments", response_model=CommentOut, status_code=201)
def add_comment(listing_id: uuid.UUID, payload: CommentIn, db: Session = Depends(get_db),
                current=Depends(MARKET_TRADERS)):
    _user(db, current)
    listing = _visible_listing(db, listing_id)
    body = payload.body.strip()
    if not body:
        raise HTTPException(status_code=400, detail="Write something first.")
    if limiter.check_and_hit(f"market-comment:{current['id']}", 30, 60 * 60):
        raise too_many_requests(60 * 60)
    parent_id = None
    if payload.parent_id:
        parent = db.query(ListingComment).filter(ListingComment.id == payload.parent_id,
                                                 ListingComment.listing_id == listing.id).first()
        if not parent:
            raise HTTPException(status_code=404, detail="The comment you are replying to was deleted.")
        # Replying to a reply joins the same thread (one level deep)
        parent_id = parent.parent_id or parent.id
    comment = ListingComment(listing_id=listing.id, user_id=current["id"], body=body, parent_id=parent_id)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return _comment_out(comment, listing, current)


@router.delete("/comments/{comment_id}")
def delete_comment(comment_id: uuid.UUID, db: Session = Depends(get_db), current=Depends(MARKET_VIEWERS)):
    """The comment's author, the listing owner, or an admin (moderation) can delete it."""
    comment = db.query(ListingComment).filter(ListingComment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    listing = db.query(Listing).filter(Listing.id == comment.listing_id).first()
    if not _comment_out(comment, listing, current).can_delete:
        raise HTTPException(status_code=403, detail="You can't delete this comment.")
    # Deleting a comment removes its replies and likes too
    ids = [comment.id] + [r[0] for r in db.query(ListingComment.id).filter(ListingComment.parent_id == comment.id)]
    db.query(CommentLike).filter(CommentLike.comment_id.in_(ids)).delete(synchronize_session=False)
    db.query(ListingComment).filter(ListingComment.parent_id == comment.id).delete(synchronize_session=False)
    db.delete(comment)
    db.commit()
    return {"message": "Comment deleted.", "deleted": len(ids)}


def _toggle_comment_like(db: Session, comment_id: uuid.UUID, current: dict, on: bool) -> ReactionOut:
    comment = db.query(ListingComment).filter(ListingComment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    _visible_listing(db, comment.listing_id)
    row = db.query(CommentLike).filter(CommentLike.comment_id == comment.id,
                                       CommentLike.user_id == current["id"]).first()
    if on and not row:
        db.add(CommentLike(comment_id=comment.id, user_id=current["id"]))
    elif not on and row:
        db.delete(row)
    try:
        db.commit()
    except Exception:     # double tap raced the unique constraint
        db.rollback()
    count = db.query(func.count(CommentLike.id)).filter(CommentLike.comment_id == comment.id).scalar()
    return ReactionOut(active=on, count=count)


@router.put("/comments/{comment_id}/like", response_model=ReactionOut)
def like_comment(comment_id: uuid.UUID, db: Session = Depends(get_db), current=Depends(MARKET_TRADERS)):
    return _toggle_comment_like(db, comment_id, current, True)


@router.delete("/comments/{comment_id}/like", response_model=ReactionOut)
def unlike_comment(comment_id: uuid.UUID, db: Session = Depends(get_db), current=Depends(MARKET_TRADERS)):
    return _toggle_comment_like(db, comment_id, current, False)


# ---------------------------------------------------------------------------
# offers
# ---------------------------------------------------------------------------

def _load_offer(db: Session, offer_id: uuid.UUID) -> Offer:
    offer = (db.query(Offer).options(selectinload(Offer.listing).selectinload(Listing.owner),
                                     selectinload(Offer.from_user))
             .filter(Offer.id == offer_id).first())
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    return offer


@router.post("/listings/{listing_id}/offers", response_model=OfferOut, status_code=201)
def make_offer(listing_id: uuid.UUID, payload: OfferIn, db: Session = Depends(get_db),
               current=Depends(MARKET_TRADERS)):
    """Offer to buy (on a 'sell' listing) or to supply (on a 'wanted' listing)."""
    _user(db, current)
    listing = _load_listing(db, listing_id)
    if listing.status != ListingStatus.active:
        raise HTTPException(status_code=400, detail="This listing is no longer available.")
    if listing.owner_id == current["id"]:
        raise HTTPException(status_code=400, detail="You can't make an offer on your own listing.")
    if db.query(Offer).filter(Offer.listing_id == listing.id, Offer.from_user_id == current["id"],
                              Offer.status == OfferStatus.pending).first():
        raise HTTPException(status_code=409, detail="You already have a pending offer on this listing.")
    if limiter.check_and_hit(f"market-offer:{current['id']}", 30, 60 * 60):
        raise too_many_requests(60 * 60)

    offer = Offer(listing_id=listing.id, from_user_id=current["id"], **payload.model_dump(),
                  status=OfferStatus.pending)
    db.add(offer)
    db.commit()
    return _offer_out(_load_offer(db, offer.id), current)


@router.get("/notifications")
def market_notifications(db: Session = Depends(get_db), current=Depends(MARKET_TRADERS)):
    """Badge counts for My activity: offers waiting for my answer + answers to my offers I haven't seen."""
    received = (db.query(func.count(Offer.id)).join(Listing, Listing.id == Offer.listing_id)
                .filter(Listing.owner_id == current["id"], Offer.status == OfferStatus.pending).scalar())
    updates = db.query(func.count(Offer.id)).filter(
        Offer.from_user_id == current["id"],
        Offer.status.in_([OfferStatus.accepted, OfferStatus.declined]),
        Offer.response_seen_at.is_(None),
    ).scalar()
    return {"offers_received": received, "offer_updates": updates, "total": received + updates}


@router.post("/notifications/seen-updates")
def mark_offer_updates_seen(db: Session = Depends(get_db), current=Depends(MARKET_TRADERS)):
    """Called when the member opens "Offers sent": the accept/decline badges are cleared."""
    db.query(Offer).filter(
        Offer.from_user_id == current["id"],
        Offer.status.in_([OfferStatus.accepted, OfferStatus.declined]),
        Offer.response_seen_at.is_(None),
    ).update({Offer.response_seen_at: datetime.utcnow()}, synchronize_session=False)
    db.commit()
    return {"ok": True}


@router.get("/offers", response_model=list[OfferOut])
def my_offers(box: str = Query("received", pattern="^(received|sent)$"), db: Session = Depends(get_db),
              current=Depends(MARKET_TRADERS)):
    query = db.query(Offer).options(selectinload(Offer.listing).selectinload(Listing.owner),
                                    selectinload(Offer.from_user))
    if box == "sent":
        query = query.filter(Offer.from_user_id == current["id"])
    else:
        query = query.join(Listing, Listing.id == Offer.listing_id).filter(Listing.owner_id == current["id"])
    return [_offer_out(o, current) for o in query.order_by(Offer.created_at.desc()).limit(200).all()]


@router.post("/offers/{offer_id}/{action}", response_model=OfferOut)
def respond_to_offer(offer_id: uuid.UUID, action: str, db: Session = Depends(get_db),
                     current=Depends(MARKET_TRADERS)):
    offer = _load_offer(db, offer_id)
    if offer.status != OfferStatus.pending:
        raise HTTPException(status_code=400, detail=f"This offer is already {offer.status.value}.")
    is_owner = offer.listing.owner_id == current["id"]
    if action in ("accept", "decline"):
        if not is_owner:
            raise HTTPException(status_code=403, detail="Only the listing owner can accept or decline.")
        offer.status = OfferStatus.accepted if action == "accept" else OfferStatus.declined
    elif action == "cancel":
        if offer.from_user_id != current["id"]:
            raise HTTPException(status_code=403, detail="Only the person who made the offer can cancel it.")
        offer.status = OfferStatus.cancelled
    else:
        raise HTTPException(status_code=404, detail="Unknown action")
    offer.responded_at = datetime.utcnow()
    db.commit()
    return _offer_out(_load_offer(db, offer.id), current)


# ---------------------------------------------------------------------------
# reports & moderation
# ---------------------------------------------------------------------------

@router.post("/listings/{listing_id}/report", status_code=201)
def report_listing(listing_id: uuid.UUID, payload: ReportIn, db: Session = Depends(get_db),
                   current=Depends(MARKET_TRADERS)):
    listing = _load_listing(db, listing_id)
    if limiter.check_and_hit(f"market-report:{current['id']}", 10, 60 * 60):
        raise too_many_requests(60 * 60)
    db.add(ListingReport(listing_id=listing.id, reporter_id=current["id"], reason=payload.reason.strip()))
    db.commit()
    return {"message": "Thank you. A moderator will review this listing."}


@router.get("/admin/reports", response_model=list[ReportOut])
def list_reports(status: str = "open", db: Session = Depends(get_db), current=Depends(ADMIN_ONLY)):
    reports = (db.query(ListingReport).options(selectinload(ListingReport.listing))
               .filter(ListingReport.status == status).order_by(ListingReport.created_at.desc()).limit(200).all())
    return [ReportOut(id=r.id, listing_id=r.listing_id, listing_title=r.listing.title,
                      listing_status=r.listing.status, reason=r.reason, status=r.status,
                      created_at=r.created_at) for r in reports]


@router.post("/admin/listings/{listing_id}/remove")
def admin_remove_listing(listing_id: uuid.UUID, db: Session = Depends(get_db), current=Depends(ADMIN_ONLY)):
    listing = _load_listing(db, listing_id)
    listing.status = ListingStatus.removed
    for r in db.query(ListingReport).filter(ListingReport.listing_id == listing.id, ListingReport.status == "open"):
        r.status = "actioned"
        r.resolved_by = current["id"]
    log_action(db, current["id"], current["role"], "market_remove_listing", "Listing", listing.id,
               new_value={"title": listing.title}, commit=False)
    db.commit()
    return {"message": "Listing removed."}


@router.post("/admin/reports/{report_id}/dismiss")
def admin_dismiss_report(report_id: uuid.UUID, db: Session = Depends(get_db), current=Depends(ADMIN_ONLY)):
    report = db.query(ListingReport).filter(ListingReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    report.status = "dismissed"
    report.resolved_by = current["id"]
    db.commit()
    return {"message": "Report dismissed."}
