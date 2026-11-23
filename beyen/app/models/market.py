"""
Marketplace: farmers and traders (and station managers) post products for sale
or "wanted" requests, attach photos / a short video, and respond with offers.
Independent of the buying-station tables; nothing here belongs to a tenant.
"""
import uuid
import enum
from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import String, Text, Float, Boolean, Integer, Date, DateTime, ForeignKey, Enum, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base
from app.models.types import Money


class ListingKind(str, enum.Enum):
    sell = "sell"        # "I have this to sell"
    wanted = "wanted"    # "I want to buy this"


class ListingStatus(str, enum.Enum):
    active = "active"
    sold = "sold"
    closed = "closed"
    removed = "removed"  # taken down by an admin


class OfferStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    declined = "declined"
    cancelled = "cancelled"


class Listing(Base):
    __tablename__ = "market_listings"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    kind: Mapped[ListingKind] = mapped_column(Enum(ListingKind), default=ListingKind.sell)
    category: Mapped[str] = mapped_column(String(40), index=True)
    title: Mapped[str] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    quantity: Mapped[float | None] = mapped_column(Float, nullable=True)
    unit: Mapped[str] = mapped_column(String(20), default="kg")
    price: Mapped[Decimal | None] = mapped_column(Money, nullable=True)   # per unit, Nle
    negotiable: Mapped[bool] = mapped_column(Boolean, default=True)
    district: Mapped[str] = mapped_column(String(60), index=True)
    chiefdom: Mapped[str | None] = mapped_column(String(120), nullable=True)
    available_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[ListingStatus] = mapped_column(Enum(ListingStatus), default=ListingStatus.active, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("User")
    media = relationship("ListingMedia", back_populates="listing", order_by="ListingMedia.sort_order",
                         cascade="all, delete-orphan")


class ListingMedia(Base):
    __tablename__ = "market_listing_media"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    listing_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("market_listings.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(10))          # photo | video
    path: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(60))
    size_bytes: Mapped[int] = mapped_column(Integer)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    listing = relationship("Listing", back_populates="media")


class Offer(Base):
    """A response to a listing: a purchase offer on a 'sell' post, or a supply offer on a 'wanted' post."""
    __tablename__ = "market_offers"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    listing_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("market_listings.id", ondelete="CASCADE"), index=True)
    from_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    quantity: Mapped[float | None] = mapped_column(Float, nullable=True)
    price: Mapped[Decimal | None] = mapped_column(Money, nullable=True)   # per unit, Nle
    message: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[OfferStatus] = mapped_column(Enum(OfferStatus), default=OfferStatus.pending, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    responded_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # When the person who made the offer saw the accept/decline (drives the notification badge)
    response_seen_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # Measuring the "For you" feed: did the offerer already need/sell this category when offering?
    was_match: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    listing = relationship("Listing")
    from_user = relationship("User")


class ListingReport(Base):
    __tablename__ = "market_reports"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    listing_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("market_listings.id", ondelete="CASCADE"), index=True)
    reporter_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    reason: Mapped[str] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(20), default="open", index=True)   # open | actioned | dismissed
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    resolved_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    listing = relationship("Listing")


class ListingLike(Base):
    __tablename__ = "market_likes"
    __table_args__ = (UniqueConstraint("listing_id", "user_id", name="uq_market_likes_listing_user"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    listing_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("market_listings.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ListingSave(Base):
    """Bookmark: a post the user wants to find again (not a file download)."""
    __tablename__ = "market_saves"
    __table_args__ = (UniqueConstraint("listing_id", "user_id", name="uq_market_saves_listing_user"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    listing_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("market_listings.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ListingComment(Base):
    __tablename__ = "market_comments"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    listing_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("market_listings.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    # Replies point at a top-level comment (one level deep, like most social apps)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("market_comments.id", ondelete="CASCADE"), nullable=True, index=True)
    body: Mapped[str] = mapped_column(String(1000))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    author = relationship("User")


class CommentLike(Base):
    __tablename__ = "market_comment_likes"
    __table_args__ = (UniqueConstraint("comment_id", "user_id", name="uq_market_comment_likes_comment_user"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    comment_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("market_comments.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class MarketInterest(Base):
    """
    What a member buys ("needs") or sells, per category, learned from what they do.
    `score` is the value at `updated_at`; it halves every 30 days (see services/interests.py).
    """
    __tablename__ = "market_interests"
    __table_args__ = (UniqueConstraint("user_id", "category", "side", name="uq_market_interests_user_cat_side"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    category: Mapped[str] = mapped_column(String(40), index=True)
    side: Mapped[str] = mapped_column(String(10))          # needs | sells
    score: Mapped[float] = mapped_column(Float, default=0.0)
    # Ticked by the member ("What do you buy / sell?"): never fades below DECLARED_FLOOR
    declared: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class MarketAlert(Base):
    """'A post you may want': created when a new listing matches what a member needs or sells."""
    __tablename__ = "market_alerts"
    __table_args__ = (UniqueConstraint("user_id", "listing_id", name="uq_market_alerts_user_listing"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    listing_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("market_listings.id", ondelete="CASCADE"), index=True)
    side: Mapped[str] = mapped_column(String(10))          # why: the member needs | sells this category
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    seen_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    listing = relationship("Listing")
