import pytest
from app.models.user import User, UserStatus, UserRole
from app.core.security import hash_password
from app.services.email import SENT_EMAILS_BUFFER
from tests.conftest import ADMIN_CONTACT, ADMIN_PASSWORD

def test_login_returns_produce_name(client):
    # Admin login with seeded credentials
    res = client.post("/api/v1/auth/login", json={"contact": ADMIN_CONTACT, "password": ADMIN_PASSWORD})
    assert res.status_code == 200, res.text
    data = res.json()
    assert "access_token" in data
    assert "produce_name" in data

def test_forgot_password_flow(client, db):
    SENT_EMAILS_BUFFER.clear()
    
    # Create dedicated user for forgot password testing
    test_user = User(
        name="Reset Test User",
        contact="resetuser@comis.org",
        email="resetuser@comis.org",
        password_hash=hash_password("OldPassword123!"),
        role=UserRole.produce_manager,
        status=UserStatus.active,
        station_name="Reset Station",
        business_name="Reset Produce"
    )
    db.add(test_user)
    db.commit()

    # Request forgot password
    res = client.post("/api/v1/auth/forgot-password", json={"email": "resetuser@comis.org"})
    assert res.status_code == 200
    assert "password reset instructions have been sent" in res.json()["message"]
    
    # Check that email was sent to buffer
    assert len(SENT_EMAILS_BUFFER) == 1
    sent = SENT_EMAILS_BUFFER[0]
    assert sent["to"] == "resetuser@comis.org"
    code = sent["reset_code"]
    token = sent["reset_token"]
    assert len(code) == 6

    # A 6-digit code alone is not enough: the email must accompany it
    no_email = client.post("/api/v1/auth/reset-password", json={"token": code, "new_password": "newpassword123"})
    assert no_email.status_code == 400

    # Test resetting with code + email
    reset_res = client.post("/api/v1/auth/reset-password", json={
        "token": code, "email": "resetuser@comis.org", "new_password": "newpassword123",
    })
    assert reset_res.status_code == 200
    assert "successfully reset" in reset_res.json()["message"]

    # Verify user can log in with new password
    login_res = client.post("/api/v1/auth/login", json={"contact": "resetuser@comis.org", "password": "newpassword123"})
    assert login_res.status_code == 200

    # Code and link are single-use
    reuse = client.post("/api/v1/auth/reset-password", json={"token": token, "new_password": "anotherpass123"})
    assert reuse.status_code == 400

    # Reset codes are stored hashed, never in plain text
    db.refresh(test_user)
    assert test_user.reset_password_token is None

    # verify invalid token fails
    fail_res = client.post("/api/v1/auth/reset-password", json={"token": "999999", "email": "resetuser@comis.org", "new_password": "longenough1"})
    assert fail_res.status_code == 400


def test_reset_link_token_and_hashed_storage(client, db):
    SENT_EMAILS_BUFFER.clear()
    user = User(name="Link User", contact="linkuser@comis.org", email="linkuser@comis.org",
                password_hash=hash_password("OldPassword123!"), role=UserRole.produce_manager,
                status=UserStatus.active)
    db.add(user)
    db.commit()

    client.post("/api/v1/auth/forgot-password", json={"email": "linkuser@comis.org"})
    sent = SENT_EMAILS_BUFFER[-1]
    db.refresh(user)
    assert sent["reset_code"] not in user.reset_password_token
    assert sent["reset_token"] not in user.reset_password_token

    res = client.post("/api/v1/auth/reset-password", json={"token": sent["reset_token"], "new_password": "brandnewpass1"})
    assert res.status_code == 200
    assert client.post("/api/v1/auth/login", json={"contact": "linkuser@comis.org", "password": "brandnewpass1"}).status_code == 200


def test_reset_code_burned_after_too_many_wrong_guesses(client, db):
    SENT_EMAILS_BUFFER.clear()
    user = User(name="Guess User", contact="guessuser@comis.org", email="guessuser@comis.org",
                password_hash=hash_password("OldPassword123!"), role=UserRole.produce_manager,
                status=UserStatus.active)
    db.add(user)
    db.commit()

    client.post("/api/v1/auth/forgot-password", json={"email": "guessuser@comis.org"})
    real_code = SENT_EMAILS_BUFFER[-1]["reset_code"]
    wrong = "100000" if real_code != "100000" else "100001"
    for _ in range(5):
        r = client.post("/api/v1/auth/reset-password", json={"token": wrong, "email": "guessuser@comis.org", "new_password": "whatever123"})
        assert r.status_code == 400

    # The real code no longer works after 5 wrong guesses
    r = client.post("/api/v1/auth/reset-password", json={"token": real_code, "email": "guessuser@comis.org", "new_password": "whatever123"})
    assert r.status_code == 400


def test_reset_password_rate_limited_per_ip(client):
    for _ in range(10):
        client.post("/api/v1/auth/reset-password", json={"token": "x" * 40, "new_password": "whatever123"})
    r = client.post("/api/v1/auth/reset-password", json={"token": "x" * 40, "new_password": "whatever123"})
    assert r.status_code == 429


def test_forgot_password_rate_limited(client):
    statuses = [client.post("/api/v1/auth/forgot-password", json={"email": "nobody@comis.org"}).status_code
                for _ in range(4)]
    assert statuses[:3] == [200, 200, 200]
    assert statuses[3] == 429


def test_login_locked_after_repeated_failures(client):
    for _ in range(5):
        r = client.post("/api/v1/auth/login", json={"contact": ADMIN_CONTACT, "password": "wrong-password"})
        assert r.status_code == 401
    # Even the right password is refused while the account is locked out
    r = client.post("/api/v1/auth/login", json={"contact": ADMIN_CONTACT, "password": ADMIN_PASSWORD})
    assert r.status_code == 429


def test_google_auth_flow(client, db):
    # 1. On login page (mode="signin"), user does not exist -> 404
    signin_res = client.post("/api/v1/auth/google", json={
        "access_token": "google-ok:google-123456:newmanager@example.com",
        "mode": "signin"
    })
    assert signin_res.status_code == 404
    assert "Account does not exist. Signup to continue" in signin_res.json()["detail"]

    # 2. On signup page (mode="signup"), terms not agreed -> 400
    terms_res = client.post("/api/v1/auth/google", json={
        "access_token": "google-ok:google-123456:newmanager@example.com",
        "mode": "signup",
        "terms_accepted": False
    })
    assert terms_res.status_code == 400
    assert "Terms" in terms_res.json()["detail"]

    # 3. On signup page (mode="signup"), terms agreed -> registers as pending approval -> 403
    res = client.post("/api/v1/auth/google", json={
        "access_token": "google-ok:google-123456:newmanager@example.com",
        "name": "Jane Doe",
        "produce_name": "Doe Organic Produce",
        "mode": "signup",
        "terms_accepted": True
    })
    assert res.status_code == 403
    assert "pending System Admin approval" in res.json()["detail"]

    # System admin approves user
    new_user = db.query(User).filter(User.google_id == "google-123456").first()
    assert new_user is not None
    assert new_user.email == "newmanager@example.com"
    assert new_user.business_name == "Doe Organic Produce"
    new_user.status = UserStatus.active
    db.commit()

    # Login again with Google (mode="signin")
    login_res = client.post("/api/v1/auth/google", json={
        "access_token": "google-ok:google-123456:newmanager@example.com",
        "mode": "signin"
    })
    assert login_res.status_code == 200
    data = login_res.json()
    assert data["produce_name"] == "Doe Organic Produce"
    assert data["role"] == "produce_manager"


def test_google_auth_rejects_unverified_claims(client):
    """The old endpoint accepted a bare email; that must never log anyone in again."""
    # Bare email, no token
    res = client.post("/api/v1/auth/google", json={"email": ADMIN_CONTACT, "mode": "signin"})
    assert res.status_code == 400

    # Forged token
    res = client.post("/api/v1/auth/google", json={"access_token": "forged", "email": ADMIN_CONTACT, "mode": "signin"})
    assert res.status_code == 401

    # Client-supplied email is ignored: identity comes from the verified token only
    res = client.post("/api/v1/auth/google", json={
        "access_token": "google-ok:attacker-sub:attacker@example.com",
        "email": ADMIN_CONTACT, "google_id": "whatever", "mode": "signin",
    })
    assert res.status_code == 404


def test_admin_suspend_delete_and_uniqueness(client, db):
    # Admin logs in
    res = client.post("/api/v1/auth/login", json={"contact": ADMIN_CONTACT, "password": ADMIN_PASSWORD})
    assert res.status_code == 200
    admin_token = res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Verify System Admin CANNOT add secretary or seller
    sec_fail = client.post("/api/v1/users/secretaries", headers=admin_headers, json={
        "name": "Forbidden Sec",
        "contact": "077000111",
        "password": "Password123!"
    })
    assert sec_fail.status_code == 403
    assert "System Admin does not add secretaries" in sec_fail.json()["detail"]

    seller_fail = client.post("/api/v1/sellers/", headers=admin_headers, json={
        "name": "Forbidden Seller",
        "contact": "077000222"
    })
    assert seller_fail.status_code == 403
    assert "System Admin does not register sellers" in seller_fail.json()["detail"]

    # 1. Uniqueness check: Cannot register manager with existing admin's contact/email
    res = client.post("/api/v1/users/managers", json={
        "name": "Clash Manager",
        "contact": ADMIN_CONTACT,
        "password": "Password123!",
    })
    assert res.status_code == 409
    assert "unique" in res.json()["detail"].lower()

    # Register unique manager
    res = client.post("/api/v1/users/managers", json={
        "name": "Unique Manager",
        "contact": "unique.manager@test.com",
        "email": "unique.manager@test.com",
        "password": "Password123!",
        "business_name": "Unique Produce",
    })
    assert res.status_code == 201
    mgr_id = res.json()["id"]

    # Trying to register another manager with same email -> 409
    res = client.post("/api/v1/users/managers", json={
        "name": "Duplicate Manager",
        "contact": "different.contact@test.com",
        "email": "unique.manager@test.com",
        "password": "Password123!",
    })
    assert res.status_code == 409
    assert "unique" in res.json()["detail"].lower()

    # Admin approves manager
    res = client.post(f"/api/v1/users/{mgr_id}/approve", headers=admin_headers)
    assert res.status_code == 200

    # 2. Suspend user functionality
    res = client.post(f"/api/v1/users/{mgr_id}/suspend", headers=admin_headers)
    assert res.status_code == 200
    assert res.json()["status"] == "suspended"

    # Suspended user cannot log in
    res = client.post("/api/v1/auth/login", json={"contact": "unique.manager@test.com", "password": "Password123!"})
    assert res.status_code == 403

    # Reactivate user
    res = client.post(f"/api/v1/users/{mgr_id}/reactivate", headers=admin_headers)
    assert res.status_code == 200
    assert res.json()["status"] == "active"

    # Reactivated user can log in
    res = client.post("/api/v1/auth/login", json={"contact": "unique.manager@test.com", "password": "Password123!"})
    assert res.status_code == 200
    mgr_token = res.json()["access_token"]
    mgr_headers = {"Authorization": f"Bearer {mgr_token}"}

    # 3. Cannot create secretary with manager's email or contact -> 409
    res = client.post("/api/v1/users/secretaries", headers=mgr_headers, json={
        "name": "Clashing Secretary",
        "contact": "unique.manager@test.com",
        "password": "Password123!",
    })
    assert res.status_code == 409

    # 4. Admin cannot delete self -> 400
    admin_user = db.query(User).filter(User.contact == ADMIN_CONTACT).first()
    res = client.delete(f"/api/v1/users/{admin_user.id}", headers=admin_headers)
    assert res.status_code == 400

    # 5. Admin deletes manager -> 200 and removed from db
    res = client.delete(f"/api/v1/users/{mgr_id}", headers=admin_headers)
    assert res.status_code == 200
    assert "deleted successfully" in res.json()["message"]

    import uuid as _uuid
    deleted_check = db.query(User).filter(User.id == _uuid.UUID(mgr_id)).first()
    assert deleted_check is None

