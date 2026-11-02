"""
Test configuration — in-memory / file SQLite DB so tests run without external Postgres.
"""
import os

# Must be set before app settings are imported
ADMIN_CONTACT = "admin@comis.test"
ADMIN_PASSWORD = "Test-Admin-Password-1"
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_comis.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-that-is-long-enough-for-validation")
os.environ["APP_ENV"] = "testing"
os.environ["ADMIN_EMAIL"] = ADMIN_CONTACT
os.environ["ADMIN_PASSWORD"] = ADMIN_PASSWORD

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.rate_limit import limiter
from app.services import google_auth

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.db.seed import seed_database

TEST_DATABASE_URL = "sqlite:///./test_comis.db"

test_engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()
    seed_database(db)
    db.close()
    yield
    Base.metadata.drop_all(bind=test_engine)
    if os.path.exists("./test_comis.db"):
        try:
            os.remove("./test_comis.db")
        except Exception:
            pass


@pytest.fixture(autouse=True)
def reset_rate_limits():
    limiter.reset()
    yield
    limiter.reset()


# Fake Google: access token "google-ok:<sub>:<email>" verifies; anything else is rejected.
def _fake_verify_google_access_token(access_token: str) -> google_auth.GoogleIdentity:
    parts = access_token.split(":", 2)
    if len(parts) != 3 or parts[0] != "google-ok":
        raise google_auth.GoogleAuthError("Google rejected the sign-in token.")
    return google_auth.GoogleIdentity(sub=parts[1], email=parts[2].lower())


@pytest.fixture(autouse=True)
def fake_google(monkeypatch):
    monkeypatch.setattr(google_auth, "verify_google_access_token", _fake_verify_google_access_token)


@pytest.fixture
def db():
    database = TestingSessionLocal()
    yield database
    database.close()


@pytest.fixture
def client(setup_test_db):
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
