"""
Auth endpoint.
Login returns a JWT with role, name, and produce_name claims.
Includes password reset via email and Google OAuth authentication.

Abuse protection:
- Failed logins are rate-limited per IP and per account.
- Reset codes are stored hashed, expire after 30 minutes, and are burned after
  5 wrong guesses. A 6-digit code is only accepted together with the email.
- Google sign-in trusts only what Google itself says about the token.
"""
import hashlib
import hmac
import secrets
import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.user import User, UserRole, UserStatus
from app.core.security import verify_password, hash_password, create_access_token
from app.core.rate_limit import limiter, client_ip, too_many_requests
from app.schemas.user import UserLogin, Token, ForgotPasswordRequest, ResetPasswordRequest, GoogleAuthRequest
from app.services.email import send_password_reset_email
from app.services import google_auth

router = APIRouter()

LOGIN_WINDOW = 15 * 60
LOGIN_MAX_FAILURES_PER_ACCOUNT = 5
LOGIN_MAX_FAILURES_PER_IP = 30

FORGOT_WINDOW = 15 * 60
FORGOT_MAX_PER_IP = 5
FORGOT_MAX_PER_ACCOUNT = 3

RESET_WINDOW = 15 * 60
RESET_MAX_FAILURES_PER_IP = 10
RESET_CODE_TTL = timedelta(minutes=30)
RESET_MAX_ATTEMPTS = 5

GOOGLE_WINDOW = 5 * 60
GOOGLE_MAX_PER_IP = 20

MIN_PASSWORD_LENGTH = 8


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _clear_reset(user: User) -> None:
    user.reset_password_token = None
    user.reset_password_expires_at = None
    user.reset_password_attempts = 0


def _issue_token(user: User, db: Session) -> Token:
    # Ensure produce_id is populated for Manager if missing
    if not user.produce_id and user.role == UserRole.produce_manager:
        user.produce_id = user.id
        db.commit()
        db.refresh(user)

    token = create_access_token(
        user.id,
        user.role.value,
        name=user.name,
        produce_id=user.produce_id,
        station_name=user.station_name,
        business_name=user.business_name,
    )
    return Token(
        access_token=token,
        role=user.role,
        name=user.name,
        user_id=user.id,
        station_name=user.station_name,
        business_name=user.business_name,
        produce_name=user.business_name or user.station_name,
        produce_id=user.produce_id,
    )


@router.post("/login", response_model=Token)
def login(payload: UserLogin, request: Request, db: Session = Depends(get_db)):
    identifier = (payload.email or payload.contact or "").strip()
    if not identifier:
        raise HTTPException(status_code=400, detail="Email or contact is required.")

    ip_key = f"login-fail:ip:{client_ip(request)}"
    account_key = f"login-fail:acct:{identifier.lower()}"
    if (limiter.is_limited(ip_key, LOGIN_MAX_FAILURES_PER_IP, LOGIN_WINDOW)
            or limiter.is_limited(account_key, LOGIN_MAX_FAILURES_PER_ACCOUNT, LOGIN_WINDOW)):
        raise too_many_requests(LOGIN_WINDOW)

    user = db.query(User).filter(
        (User.contact == identifier) | (User.email == identifier)
    ).first()
    if not user or not verify_password(payload.password, user.password_hash):
        limiter.hit(ip_key)
        limiter.hit(account_key)
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if user.status != UserStatus.active:
        raise HTTPException(status_code=403, detail=f"Account is {user.status.value}. Contact a System Admin.")
    limiter.reset(account_key)

    return _issue_token(user, db)


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)):
    """
    Sends a 6-digit reset code and password reset link to user's email.
    Supports Produce Managers, Secretaries, and System Admins.
    The response is identical whether or not the account exists.
    """
    email_or_contact = (payload.email or "").strip()
    if not email_or_contact:
        raise HTTPException(status_code=400, detail="Email is required.")

    if (limiter.check_and_hit(f"forgot:ip:{client_ip(request)}", FORGOT_MAX_PER_IP, FORGOT_WINDOW)
            or limiter.check_and_hit(f"forgot:acct:{email_or_contact.lower()}", FORGOT_MAX_PER_ACCOUNT, FORGOT_WINDOW)):
        raise too_many_requests(FORGOT_WINDOW)

    user = db.query(User).filter(
        (User.email.ilike(email_or_contact)) | (User.contact.ilike(email_or_contact))
    ).first()

    if user:
        code = f"{secrets.randbelow(900000) + 100000}"
        raw_token = secrets.token_urlsafe(32)
        # Only hashes are stored: a database leak doesn't hand out working reset codes
        user.reset_password_token = f"{_sha256(code)}:{_sha256(raw_token)}"
        user.reset_password_expires_at = datetime.utcnow() + RESET_CODE_TTL
        user.reset_password_attempts = 0
        db.commit()

        recipient_email = user.email or (user.contact if "@" in user.contact else None) or email_or_contact
        send_password_reset_email(
            to_email=recipient_email,
            user_name=user.name,
            reset_token=raw_token,
            reset_code=code,
        )

    return {
        "message": "If an account exists with this email, password reset instructions have been sent."
    }


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, request: Request, db: Session = Depends(get_db)):
    """
    Sets a new password using either:
      - the long token from the emailed link (on its own), or
      - the 6-digit code together with the account email.
    """
    if not payload.token or not payload.new_password:
        raise HTTPException(status_code=400, detail="Reset token/code and new password are required.")

    if len(payload.new_password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(status_code=400, detail=f"Password must be at least {MIN_PASSWORD_LENGTH} characters long.")

    ip_key = f"reset-fail:ip:{client_ip(request)}"
    if limiter.is_limited(ip_key, RESET_MAX_FAILURES_PER_IP, RESET_WINDOW):
        raise too_many_requests(RESET_WINDOW)

    req_token = payload.token.strip()
    req_hash = _sha256(req_token)
    now = datetime.utcnow()
    is_short_code = req_token.isdigit() and len(req_token) == 6

    matched_user = None
    if is_short_code:
        email = (payload.email or "").strip()
        if not email:
            limiter.hit(ip_key)
            raise HTTPException(status_code=400, detail="Enter the email address the code was sent to.")
        user = db.query(User).filter((User.email.ilike(email)) | (User.contact.ilike(email))).first()
        if user and user.reset_password_token and user.reset_password_expires_at and user.reset_password_expires_at > now:
            code_hash = user.reset_password_token.split(":")[0]
            if hmac.compare_digest(code_hash, req_hash):
                matched_user = user
            else:
                # Burn the code after too many wrong guesses
                user.reset_password_attempts = (user.reset_password_attempts or 0) + 1
                if user.reset_password_attempts >= RESET_MAX_ATTEMPTS:
                    _clear_reset(user)
                db.commit()
    else:
        candidates = db.query(User).filter(
            User.reset_password_token.like(f"%:{req_hash}"),
            User.reset_password_expires_at > now,
        ).all()
        for u in candidates:
            if hmac.compare_digest(u.reset_password_token.split(":")[-1], req_hash):
                matched_user = u
                break

    if not matched_user:
        limiter.hit(ip_key)
        raise HTTPException(status_code=400, detail="Invalid or expired password reset token or code.")

    matched_user.password_hash = hash_password(payload.new_password)
    _clear_reset(matched_user)
    db.commit()

    return {
        "message": "Password has been successfully reset. You can now log in."
    }


@router.post("/google", response_model=Token)
def google_auth_login(payload: GoogleAuthRequest, request: Request, db: Session = Depends(get_db)):
    """
    Authenticates or registers a user via Google Sign-In.
    - If user exists and is active: returns auth JWT.
    - If user exists and pending: returns 403 approval notice.
    - If user does not exist: auto-registers as Produce Manager (pending approval).

    Identity (email, Google account id) comes only from Google's verification of
    the access token — never from fields the browser sends.
    """
    if limiter.check_and_hit(f"google:ip:{client_ip(request)}", GOOGLE_MAX_PER_IP, GOOGLE_WINDOW):
        raise too_many_requests(GOOGLE_WINDOW)

    if not payload.access_token:
        raise HTTPException(status_code=400, detail="Google authentication failed: missing access token.")
    try:
        identity = google_auth.verify_google_access_token(payload.access_token.strip())
    except google_auth.GoogleAuthError as e:
        raise HTTPException(status_code=401, detail=f"Google authentication failed: {e}")

    email = identity.email
    google_id = identity.sub
    name = (payload.name or "").strip()  # display name only; not used for identity
    produce_name = (payload.produce_name or "").strip()

    # Search for user by Google account id, then by (Google-verified) email
    user = db.query(User).filter(User.google_id == google_id).first()
    if not user:
        user = db.query(User).filter(
            (User.email.ilike(email)) | (User.contact.ilike(email))
        ).first()
        if user and user.google_id and user.google_id != google_id:
            raise HTTPException(status_code=401, detail="This email is linked to a different Google account.")

    mode = (payload.mode or "signin").strip().lower()
    terms_accepted = bool(payload.terms_accepted)

    if user:
        # Link google_id and email if missing
        if not user.google_id:
            user.google_id = google_id
        if not user.email:
            user.email = email
        db.commit()

        if user.status == UserStatus.pending:
            raise HTTPException(status_code=403, detail="Your account is pending System Admin approval.")
        if user.status != UserStatus.active:
            raise HTTPException(status_code=403, detail=f"Account is {user.status.value}. Contact a System Admin.")

        return _issue_token(user, db)

    # User does NOT exist in the database
    if mode == "signin":
        raise HTTPException(
            status_code=404,
            detail="Account does not exist. Signup to continue."
        )

    # mode == "signup" -> Verify user confirmed terms agreement
    if not terms_accepted:
        raise HTTPException(
            status_code=400,
            detail="You must agree to the Terms of Service, User Agreement, and Privacy Policy to continue."
        )

    # Auto-register Produce Manager as PENDING
    resolved_name = name or email.split("@")[0].capitalize()
    resolved_produce = produce_name or f"{resolved_name}'s Produce"
    new_user_id = uuid.uuid4()

    new_user = User(
        id=new_user_id,
        name=resolved_name,
        contact=email,
        email=email,
        google_id=google_id,
        password_hash=hash_password(secrets.token_urlsafe(24)),
        role=UserRole.produce_manager,
        status=UserStatus.pending,
        station_name=resolved_produce,
        business_name=resolved_produce,
        produce_id=new_user_id,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    raise HTTPException(
        status_code=403,
        detail="Account registered successfully with Google! It is currently pending System Admin approval."
    )

