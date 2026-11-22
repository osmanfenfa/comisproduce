import uuid
import enum
from datetime import datetime
from sqlalchemy import String, Enum, DateTime, ForeignKey, Boolean, Integer
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class UserRole(str, enum.Enum):
    system_admin = "system_admin"
    produce_manager = "produce_manager"
    produce_secretary = "produce_secretary"
    # Marketplace accounts: not tied to any buying station (no produce_id)
    farmer = "farmer"
    trader = "trader"


class UserStatus(str, enum.Enum):
    pending = "pending"
    active = "active"
    suspended = "suspended"
    inactive = "inactive"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    contact: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)  # phone or email, used to log in
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False)
    status: Mapped[UserStatus] = mapped_column(Enum(UserStatus), default=UserStatus.pending)
    station_name: Mapped[str] = mapped_column(String(120), nullable=True)  # Manager/Secretary station scope
    business_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email: Mapped[str | None] = mapped_column(String(120), nullable=True, unique=True, index=True)
    phone_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    gender: Mapped[str | None] = mapped_column(String(20), nullable=True)

    reset_password_token: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    reset_password_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    reset_password_attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False, server_default="0")
    google_id: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True)
    produce_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True, index=True)  # Root tenant ID (Manager ID)

    # Marketplace profile (farmers / traders)
    district: Mapped[str | None] = mapped_column(String(60), nullable=True)
    chiefdom: Mapped[str | None] = mapped_column(String(120), nullable=True)
    phone_verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    phone_otp_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    phone_otp_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    phone_otp_attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False, server_default="0")

    # Profile photo (any role): Cloudinary URL or local media path
    avatar_path: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Identity document (market verification): National ID (NIN) or passport
    id_doc_type: Mapped[str | None] = mapped_column(String(20), nullable=True)        # nin | passport
    id_doc_number: Mapped[str | None] = mapped_column(String(40), nullable=True, index=True)
    id_doc_number_read: Mapped[str | None] = mapped_column(String(40), nullable=True)  # what OCR found
    id_doc_path: Mapped[str | None] = mapped_column(String(255), nullable=True)       # private storage
    id_status: Mapped[str] = mapped_column(String(20), default="none", nullable=False, server_default="none")
    id_submitted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    id_reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    id_reviewed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    id_reject_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)

    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=True)
    approved_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    approved_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
