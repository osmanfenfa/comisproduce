"""
DB seed — runs at application startup.
Creates the global AppSettings row and, if ADMIN_EMAIL / ADMIN_PASSWORD are
configured, the first System Admin account. Safe to call repeatedly (idempotent).

There is deliberately no built-in admin password: set ADMIN_EMAIL and
ADMIN_PASSWORD in the environment for the first boot, then remove them.
"""
import uuid
from sqlalchemy.orm import Session
from app.models.user import User, UserRole, UserStatus
from app.models.settings_model import AppSettings, GLOBAL_SETTINGS_ID
from app.core.security import hash_password, verify_password
from app.core.config import settings

MIN_ADMIN_PASSWORD_LENGTH = 12


# Credentials that earlier versions seeded automatically. They are public (in git
# history), so any account still using them is suspended at startup.
_LEGACY_ADMIN_CONTACT = "admin@comis.local"
_LEGACY_ADMIN_PASSWORD = "ComisAdmin2024!"


def seed_database(db: Session) -> None:
    _seed_settings(db)
    _suspend_legacy_default_admin(db)
    _seed_admin(db)


def _suspend_legacy_default_admin(db: Session) -> None:
    legacy = db.query(User).filter(User.contact == _LEGACY_ADMIN_CONTACT).first()
    if legacy and legacy.status == UserStatus.active and verify_password(_LEGACY_ADMIN_PASSWORD, legacy.password_hash):
        legacy.status = UserStatus.suspended
        db.commit()
        print(f"[SEED] Suspended {_LEGACY_ADMIN_CONTACT}: it still used the old published default password.")


def _seed_settings(db: Session) -> None:
    row = db.query(AppSettings).filter(AppSettings.id == GLOBAL_SETTINGS_ID).first()
    if not row:
        db.add(AppSettings(
            id=GLOBAL_SETTINGS_ID,
            station_name=settings.STATION_NAME,
            standard_moisture_percent=settings.STANDARD_MOISTURE_PERCENT,
        ))
        db.commit()


def _seed_admin(db: Session) -> None:
    if db.query(User).filter(User.role == UserRole.system_admin, User.status == UserStatus.active).first():
        return

    email = (settings.ADMIN_EMAIL or "").strip().lower()
    password = settings.ADMIN_PASSWORD or ""
    if not email or not password:
        print("[SEED] No System Admin exists. Set ADMIN_EMAIL and ADMIN_PASSWORD to create one.")
        return
    if len(password) < MIN_ADMIN_PASSWORD_LENGTH:
        print(f"[SEED] ADMIN_PASSWORD must be at least {MIN_ADMIN_PASSWORD_LENGTH} characters; admin not created.")
        return

    existing = db.query(User).filter((User.contact == email) | (User.email == email)).first()
    if existing:
        # Operator-controlled recovery: (re)activate this account as admin with the new password
        existing.password_hash = hash_password(password)
        existing.role = UserRole.system_admin
        existing.status = UserStatus.active
        existing.is_active = True
    else:
        db.add(User(
            id=uuid.uuid4(),
            name="System Administrator",
            contact=email,
            email=email,
            password_hash=hash_password(password),
            role=UserRole.system_admin,
            status=UserStatus.active,
            is_active=True,
        ))
    db.commit()
    print(f"[SEED] System Admin created for {email}. Remove ADMIN_PASSWORD from the environment now.")
