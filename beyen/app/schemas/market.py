import uuid
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, Field
from app.models.market import ListingKind, ListingStatus, OfferStatus

# Kept short and broad; free text in the title carries the detail.
CATEGORIES = {
    "cocoa": "Cocoa", "coffee": "Coffee", "cola": "Cola nut", "rice": "Rice",
    "cassava": "Cassava & gari", "palm_oil": "Palm oil & kernels", "groundnut": "Groundnut",
    "vegetables": "Vegetables", "fruits": "Fruits", "grains": "Maize & grains",
    "livestock": "Livestock", "poultry": "Poultry & eggs", "fish": "Fish",
    "seeds_inputs": "Seeds & inputs", "tools": "Tools & equipment", "other": "Other",
}
UNITS = ["kg", "bag", "ton", "bushel", "piece", "head", "litre", "gallon", "crate", "bunch", "basket"]


class MarketSignup(BaseModel):
    account_type: str = Field(pattern="^(farmer|trader)$")
    name: str = Field(min_length=2, max_length=120)
    phone: str
    password: str = Field(min_length=8, max_length=128)
    district: str
    chiefdom: str | None = Field(default=None, max_length=120)
    business_name: str | None = Field(default=None, max_length=150)   # traders
    terms_accepted: bool


class PhoneCodeConfirm(BaseModel):
    code: str = Field(min_length=6, max_length=6)


class MarketProfileOut(BaseModel):
    id: uuid.UUID
    name: str
    role: str
    phone: str | None
    business_name: str | None
    district: str | None
    chiefdom: str | None
    phone_verified: bool
    id_status: str = "none"                  # none | draft | pending | verified | rejected
    id_doc_type: str | None = None
    id_doc_number: str | None = None
    id_reject_reason: str | None = None
    verified: bool = False                   # phone code + approved ID
    avatar_url: str | None = None


class IdExtractOut(BaseModel):
    doc_type: str
    number_read: str | None                  # what the system read from the photo
    method: str | None                       # mrz | label | None
    ocr_available: bool
    status: str


class IdConfirmIn(BaseModel):
    doc_number: str = Field(min_length=4, max_length=40)


class VerificationOut(BaseModel):
    user_id: uuid.UUID
    name: str
    role: str
    phone: str | None
    phone_verified: bool
    district: str | None
    doc_type: str | None
    doc_number: str | None
    number_read: str | None
    number_edited: bool                      # user changed what the system read
    status: str
    submitted_at: datetime | None
    reject_reason: str | None


class VerificationReject(BaseModel):
    reason: str = Field(min_length=3, max_length=255)


class MarketProfileUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    district: str | None = None
    chiefdom: str | None = Field(default=None, max_length=120)
    business_name: str | None = Field(default=None, max_length=150)


class ListingIn(BaseModel):
    kind: ListingKind = ListingKind.sell
    category: str
    title: str = Field(min_length=3, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    quantity: float | None = Field(default=None, gt=0)
    unit: str = "kg"
    price: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)
    negotiable: bool = True
    district: str
    chiefdom: str | None = Field(default=None, max_length=120)
    available_from: date | None = None


class ListingStatusUpdate(BaseModel):
    status: ListingStatus


class MediaOut(BaseModel):
    id: uuid.UUID
    kind: str
    url: str


class OwnerOut(BaseModel):
    id: uuid.UUID
    name: str
    role: str
    business_name: str | None = None
    district: str | None = None
    phone_verified: bool = False
    verified: bool = False                   # phone code + approved ID
    avatar_url: str | None = None


class ListingOut(BaseModel):
    id: uuid.UUID
    kind: ListingKind
    category: str
    category_label: str
    title: str
    description: str | None
    quantity: float | None
    unit: str
    price: float | None
    negotiable: bool
    district: str
    chiefdom: str | None
    available_from: date | None
    status: ListingStatus
    created_at: datetime
    owner: OwnerOut
    media: list[MediaOut]
    is_mine: bool = False
    my_offer_status: OfferStatus | None = None
    pending_offers: int | None = None      # owner only
    like_count: int = 0
    comment_count: int = 0
    liked_by_me: bool = False
    saved_by_me: bool = False


class OfferIn(BaseModel):
    quantity: float | None = Field(default=None, gt=0)
    price: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)
    message: str | None = Field(default=None, max_length=500)


class OfferOut(BaseModel):
    id: uuid.UUID
    listing_id: uuid.UUID
    listing_title: str
    listing_kind: ListingKind
    unit: str
    quantity: float | None
    price: float | None
    message: str | None
    status: OfferStatus
    created_at: datetime
    responded_at: datetime | None
    from_user: OwnerOut
    listing_owner: OwnerOut
    # Phone numbers are shared only once the offer is accepted
    counterpart_phone: str | None = None


class ReportIn(BaseModel):
    reason: str = Field(min_length=5, max_length=500)


class ReportOut(BaseModel):
    id: uuid.UUID
    listing_id: uuid.UUID
    listing_title: str
    listing_status: ListingStatus
    reason: str
    status: str
    created_at: datetime


class CommentIn(BaseModel):
    body: str = Field(min_length=1, max_length=1000)
    parent_id: uuid.UUID | None = None      # set to reply to a comment


class CommentOut(BaseModel):
    id: uuid.UUID
    listing_id: uuid.UUID
    body: str
    created_at: datetime
    author: OwnerOut
    can_delete: bool = False
    parent_id: uuid.UUID | None = None
    like_count: int = 0
    liked_by_me: bool = False


class ReactionOut(BaseModel):
    active: bool
    count: int
