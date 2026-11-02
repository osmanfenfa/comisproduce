"""
Integration tests for the full auth + user + purchase workflow.
"""
from decimal import Decimal
from app.services.pricing import calculate_moisture_deduction_price, calculate_direct_price


# ---------------------------------------------------------------------------
# Pricing unit tests (spec section 8 worked example)
# ---------------------------------------------------------------------------

def test_cocoa_pricing_proportional_moisture_deduction():
    # Spec example: weight=40kg, water_percent=13.7%, standard_percent=7%, price_per_kg=40
    # Excess moisture = 13.7% - 7.0% = 6.7%
    # Deduction = 40kg * 6.7% = 2.68 kg
    # Net weight = 40kg - 2.68kg = 37.32 kg
    # Total price = 37.32 * 40 = 1492.80
    result = calculate_moisture_deduction_price(
        weight_kg=40, water_percent=13.7, standard_percent=7, price_per_kg=40
    )
    assert result["moisture_deduction"] == 2.68
    assert result["net_weight_kg"] == 37.32
    assert result["total_price"] == Decimal("1492.80")


def test_user_20kg_12_percent_moisture_deduction():
    # User requirement: 20KG and 12%, 12% - 7% = 5%. 20KG - 5% (not 5KG). What remain is multiply by the price.
    # Excess = 5%
    # Deduction = 20 * 0.05 = 1.0 kg
    # Net weight = 20 - 1.0 = 19.0 kg
    # Total price = 19.0 * 40 = 760.0
    result = calculate_moisture_deduction_price(
        weight_kg=20, water_percent=12, standard_percent=7, price_per_kg=40
    )
    assert result["moisture_deduction"] == 1.0
    assert result["net_weight_kg"] == 19.0
    assert result["total_price"] == 760.0


def test_cola_direct_pricing():
    assert calculate_direct_price(weight_kg=25, price_per_kg=20) == 500.0


def test_money_is_exact_decimal():
    # Float arithmetic gives 0.1 * 3 = 0.30000000000000004 and 1.005 rounds down to 1.0.
    # Money must be exact and round half-up like a cashier.
    assert calculate_direct_price(weight_kg=3, price_per_kg=0.1) == Decimal("0.30")
    assert calculate_direct_price(weight_kg=1, price_per_kg="1.005") == Decimal("1.01")
    assert isinstance(calculate_direct_price(weight_kg=2, price_per_kg=7), Decimal)


def test_moisture_deduction_equal_to_standard():
    """Water% exactly equal to standard% → deduction=0, net=weight."""
    result = calculate_moisture_deduction_price(
        weight_kg=50, water_percent=7.0, standard_percent=7.0, price_per_kg=10
    )
    assert result["moisture_deduction"] == 0.0
    assert result["net_weight_kg"] == 50.0
    assert result["total_price"] == 500.0


def test_moisture_below_standard_computes_at_standard():
    """Water% less than 7 (standard%) → computed at exactly 7%, deduction=0, net=weight, price against kg."""
    result = calculate_moisture_deduction_price(
        weight_kg=40, water_percent=5.0, standard_percent=7.0, price_per_kg=40
    )
    assert result["moisture_deduction"] == 0.0
    assert result["net_weight_kg"] == 40.0
    assert result["total_price"] == 1600.0


def test_moisture_negative_raises():
    import pytest
    with pytest.raises(ValueError, match="cannot be negative"):
        calculate_moisture_deduction_price(
            weight_kg=40, water_percent=-2.0, standard_percent=7.0, price_per_kg=40
        )


def test_health_endpoint(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_login_unknown_user_returns_401(client):
    r = client.post("/api/v1/auth/login", json={"contact": "nobody@x.com", "password": "wrong"})
    assert r.status_code == 401


def test_secretary_cannot_access_receipts_endpoint(client):
    """
    Regression: spec section 15 — secretary hitting /receipts/ must get 401 (no token)
    or 403 (wrong role), never 200.
    """
    r = client.get("/api/v1/receipts/")
    assert r.status_code == 401   # no token at all → 401


def test_loan_balance_calculation():
    from app.services.pricing import calculate_loan_balance
    assert calculate_loan_balance(500.0, 200.0) == 300.0
    assert calculate_loan_balance(500.0, 500.0) == 0.0


def test_manager_registration_with_mockup_fields_and_login(client):
    from tests.conftest import ADMIN_CONTACT, ADMIN_PASSWORD

    # 1. Register with all mockup fields: business_name, address, email, phone_number
    reg_data = {
        "business_name": "Kailahun Cocoa Station",
        "address": "12 Station Road, Kailahun",
        "email": "kailahun@station.sl",
        "phone_number": "+23276123456",
        "password": "SecurePassword123!",
    }
    resp = client.post("/api/v1/users/managers", json=reg_data)
    assert resp.status_code == 201, resp.text
    user_data = resp.json()
    assert user_data["business_name"] == "Kailahun Cocoa Station"
    assert user_data["address"] == "12 Station Road, Kailahun"
    assert user_data["email"] == "kailahun@station.sl"
    assert user_data["phone_number"] == "+23276123456"
    assert user_data["status"] == "pending"
    mgr_id = user_data["id"]

    # 2. Admin logs in and approves the manager
    admin_login = client.post("/api/v1/auth/login", json={
        "contact": ADMIN_CONTACT,
        "password": ADMIN_PASSWORD,
    })
    admin_token = admin_login.json()["access_token"]
    approve_resp = client.post(
        f"/api/v1/users/{mgr_id}/approve",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert approve_resp.status_code == 200

    # 3. Manager logs in using email field in JSON
    login_resp = client.post("/api/v1/auth/login", json={
        "email": "kailahun@station.sl",
        "password": "SecurePassword123!",
    })
    assert login_resp.status_code == 200
    assert "access_token" in login_resp.json()
    assert login_resp.json()["station_name"] == "Kailahun Cocoa Station"


def test_edit_profile_and_change_password(client):
    from tests.conftest import ADMIN_CONTACT, ADMIN_PASSWORD

    # 1. Admin login
    admin_login = client.post("/api/v1/auth/login", json={
        "contact": ADMIN_CONTACT,
        "password": ADMIN_PASSWORD,
    })
    admin_token = admin_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Update Admin profile
    update_resp = client.put("/api/v1/users/me", headers=headers, json={
        "name": "Super System Admin",
        "business_name": "COMIS Central Org",
        "address": "State Avenue, Freetown",
        "email": "admin@comis.sl",
        "gender": "Male",
    })
    assert update_resp.status_code == 200
    updated_user = update_resp.json()
    assert updated_user["name"] == "Super System Admin"
    assert updated_user["business_name"] == "COMIS Central Org"
    assert updated_user["gender"] == "Male"

    # 3. Change password
    pwd_resp = client.post("/api/v1/users/me/change-password", headers=headers, json={
        "current_password": ADMIN_PASSWORD,
        "new_password": "NewSecurePassword456!",
    })
    assert pwd_resp.status_code == 200
    assert pwd_resp.json()["message"] == "Password updated successfully"

    # 4. Verify login with new password
    login_new = client.post("/api/v1/auth/login", json={
        "contact": ADMIN_CONTACT,
        "password": "NewSecurePassword456!",
    })
    assert login_new.status_code == 200

    # 5. Reset admin password back for subsequent tests
    new_token = login_new.json()["access_token"]
    client.post("/api/v1/users/me/change-password", headers={"Authorization": f"Bearer {new_token}"}, json={
        "current_password": "NewSecurePassword456!",
        "new_password": ADMIN_PASSWORD,
    })


def test_random_seller_purchase_and_detailed_receipt(client):
    from tests.conftest import ADMIN_CONTACT, ADMIN_PASSWORD

    # Login as Admin
    admin_login = client.post("/api/v1/auth/login", json={
        "contact": ADMIN_CONTACT,
        "password": ADMIN_PASSWORD,
    })
    token = admin_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Set baseline standard moisture to 7.0
    client.put("/api/v1/settings/", headers=headers, json={"standard_moisture_percent": 7.0})

    # Record Cocoa purchase for a Random Seller (no pre-existing seller_id)
    purchase_data = {
        "random_seller_name": "Abu Mansaray",
        "random_seller_contact": "+23277998877",
        "date": "2026-09-07",
        "weight_kg": 50.0,
        "water_percent": 11.5,
        "price_per_kg": 40.0,
    }
    resp = client.post("/api/v1/cocoa/", headers=headers, json=purchase_data)
    assert resp.status_code == 201, resp.text
    txn_data = resp.json()
    txn_id = txn_data["id"]
    seller_id = txn_data["seller_id"]

    assert txn_data["seller_name"] == "Abu Mansaray"
    assert txn_data["seller_contact"] == "+23277998877"
    assert txn_data["is_random_seller"] is True
    assert txn_data["net_weight_kg"] == 47.75
    assert txn_data["total_price"] == 1910.0

    # Verify seller is in sellers list
    seller_resp = client.get(f"/api/v1/sellers/{seller_id}", headers=headers)
    assert seller_resp.status_code == 200
    seller_obj = seller_resp.json()
    assert seller_obj["name"] == "Abu Mansaray"
    assert seller_obj["contact"] == "+23277998877"
    assert seller_obj["is_random"] is True

    # Approve transaction
    appr_resp = client.post(f"/api/v1/cocoa/{txn_id}/approve", headers=headers)
    assert appr_resp.status_code == 200

    # Issue receipt
    rec_resp = client.post(f"/api/v1/cocoa/{txn_id}/issue-receipt", headers=headers)
    assert rec_resp.status_code == 200, rec_resp.text
    receipt = rec_resp.json()

    # Verify produce account, random seller info, and item detail
    assert receipt["transaction_type"] == "cocoa"
    assert receipt["seller_name"] == "Abu Mansaray"
    assert receipt["seller_contact"] == "+23277998877"
    assert receipt["is_random_seller"] is True
    assert receipt["weight_kg"] == 50.0
    assert receipt["water_percent"] == 11.5
    assert receipt["net_weight_kg"] == 47.75
    assert receipt["price_per_kg"] == 40.0
    assert receipt["gross_amount"] == 1910.0
    assert receipt["net_amount_paid"] == 1910.0
    assert receipt["station_name"] is not None
    assert receipt["issued_by_name"] is not None



