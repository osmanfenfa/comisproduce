import uuid
from datetime import datetime
from pydantic import BaseModel
from app.models.user import UserRole, UserStatus


class ManagerRegister(BaseModel):
    """Public signup for a Produce Manager — lands as PENDING until System Admin approves."""
    business_name: str | None = None
    address: str | None = None
    email: str | None = None
    phone_number: str | None = None
    name: str | None = None
    contact: str | None = None
    password: str


class SecretaryCreate(BaseModel):
    """Created directly by a Manager — active immediately."""
    name: str
    contact: str | None = None
    email: str | None = None
    phone_number: str | None = None
    address: str | None = None
    password: str
    station_name: str | None = None


class UserLogin(BaseModel):
    email: str | None = None
    contact: str | None = None
    password: str


class UserProfileUpdate(BaseModel):
    name: str | None = None
    contact: str | None = None
    station_name: str | None = None
    business_name: str | None = None
    address: str | None = None
    email: str | None = None
    phone_number: str | None = None
    gender: str | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class UserOut(BaseModel):
    id: uuid.UUID
    name: str
    contact: str
    role: UserRole
    status: UserStatus
    station_name: str | None = None
    business_name: str | None = None
    address: str | None = None
    email: str | None = None
    phone_number: str | None = None
    gender: str | None = None
    produce_id: uuid.UUID | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class UserListOut(BaseModel):
    """Lightweight representation for list views."""
    id: uuid.UUID
    name: str
    contact: str
    role: UserRole
    status: UserStatus
    station_name: str | None = None
    business_name: str | None = None
    address: str | None = None
    email: str | None = None
    phone_number: str | None = None
    gender: str | None = None
    produce_id: uuid.UUID | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str
    email: str | None = None  # required when token is the 6-digit code


class GoogleAuthRequest(BaseModel):
    access_token: str | None = None   # verified with Google; the only source of identity
    name: str | None = None           # display name for new sign-ups
    produce_name: str | None = None
    mode: str | None = "signin"  # "signin" or "signup"
    terms_accepted: bool | None = False


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole
    name: str
    user_id: uuid.UUID
    station_name: str | None = None
    business_name: str | None = None
    produce_name: str | None = None
    produce_id: uuid.UUID | None = None

