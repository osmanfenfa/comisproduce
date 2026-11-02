"""
Business controls: per-company settings, loan deductions posted as repayments,
atomic receipt issuing, exact money, and the admin seed rules.
"""
import uuid
from decimal import Decimal
from app.models.loan import Loan, LoanRepayment
from app.models.receipt import Receipt
from app.models.user import User, UserRole, UserStatus
from app.core.security import hash_password, verify_password
from app.db.seed import seed_database
from tests.conftest import ADMIN_CONTACT, ADMIN_PASSWORD


def _login(client, contact, password):
    resp = client.post("/api/v1/auth/login", json={"contact": contact, "password": password})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def _new_manager(client, admin_headers, tag):
    contact = f"mgr.{tag}.{uuid.uuid4().hex[:6]}@example.com"
    resp = client.post("/api/v1/users/managers", json={
        "name": f"Manager {tag}", "contact": contact, "password": "Password123!",
        "business_name": f"{tag} Produce", "station_name": f"{tag} HQ",
    })
    assert resp.status_code == 201, resp.text
    assert client.post(f"/api/v1/users/{resp.json()['id']}/approve", headers=admin_headers).status_code == 200
    return _login(client, contact, "Password123!")


def _new_seller(client, headers):
    resp = client.post("/api/v1/sellers/", headers=headers, json={
        "name": "Fatmata Sesay", "gender": "female", "address": "Bo Road", "contact": "+23277000111",
    })
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _approved_cocoa(client, headers, seller_id, weight=100.0, price=10.0):
    resp = client.post("/api/v1/cocoa/", headers=headers, json={
        "seller_id": seller_id, "date": "2026-11-02",
        "weight_kg": weight, "water_percent": 7.0, "price_per_kg": price,
    })
    assert resp.status_code == 201, resp.text
    txn_id = resp.json()["id"]
    assert client.post(f"/api/v1/cocoa/{txn_id}/approve", headers=headers).status_code == 200
    return txn_id


def test_settings_are_per_company(client):
    admin = _login(client, ADMIN_CONTACT, ADMIN_PASSWORD)
    mgr_a = _new_manager(client, admin, "SetA")
    mgr_b = _new_manager(client, admin, "SetB")

    assert client.put("/api/v1/settings/", headers=mgr_a, json={"cocoa_price_per_kg": 55.5}).status_code == 200
    assert client.put("/api/v1/settings/", headers=mgr_b, json={"cocoa_price_per_kg": 41.0}).status_code == 200

    a = client.get("/api/v1/settings/", headers=mgr_a).json()
    b = client.get("/api/v1/settings/", headers=mgr_b).json()
    assert a["cocoa_price_per_kg"] == 55.5
    assert b["cocoa_price_per_kg"] == 41.0

    # The admin's global row (defaults + moisture standard) is untouched by managers
    g = client.get("/api/v1/settings/", headers=admin).json()
    assert g["produce_id"] is None
    assert g["cocoa_price_per_kg"] not in (55.5, 41.0)

    # Moisture standard is platform-wide: admin changes it, every company sees it
    assert client.put("/api/v1/settings/", headers=admin, json={"standard_moisture_percent": 7.25}).status_code == 200
    assert client.get("/api/v1/settings/", headers=mgr_a).json()["standard_moisture_percent"] == 7.25
    assert client.get("/api/v1/settings/", headers=mgr_b).json()["standard_moisture_percent"] == 7.25
    client.put("/api/v1/settings/", headers=admin, json={"standard_moisture_percent": 7.0})


def test_loan_deduction_is_posted_as_repayment(client, db):
    admin = _login(client, ADMIN_CONTACT, ADMIN_PASSWORD)
    mgr = _new_manager(client, admin, "Loan")
    seller_id = _new_seller(client, mgr)

    # Two loans: deduction should clear the older one first, then part of the newer
    l1 = client.post("/api/v1/loans/", headers=mgr, json={"seller_id": seller_id, "date": "2026-10-01", "loan_taken": 300}).json()
    l2 = client.post("/api/v1/loans/", headers=mgr, json={"seller_id": seller_id, "date": "2026-10-15", "loan_taken": 500}).json()

    txn_id = _approved_cocoa(client, mgr, seller_id, weight=100.0, price=10.0)   # gross 1000.00
    resp = client.post(f"/api/v1/cocoa/{txn_id}/issue-receipt?loan_deduction=450", headers=mgr)
    assert resp.status_code == 200, resp.text
    receipt = resp.json()
    assert receipt["gross_amount"] == 1000.0
    assert receipt["loan_deduction"] == 450.0
    assert receipt["net_amount_paid"] == 550.0

    loan1 = client.get(f"/api/v1/loans/{l1['id']}", headers=mgr).json()
    loan2 = client.get(f"/api/v1/loans/{l2['id']}", headers=mgr).json()
    assert loan1["balance"] == 0.0 and loan1["status"] == "cleared"
    assert loan2["balance"] == 350.0
    assert client.get(f"/api/v1/sellers/{seller_id}/balance", headers=mgr).json()["outstanding_balance"] == 350.0

    # Audit entry records which loans the deduction went to
    logs = client.get("/api/v1/audit-logs/", headers=admin).json()
    assert any(l["action"] == "issue_receipt" and l1["id"] in (l["new_value"] or "") for l in logs)


def test_deduction_cannot_exceed_outstanding_loans_and_nothing_is_saved(client, db):
    admin = _login(client, ADMIN_CONTACT, ADMIN_PASSWORD)
    mgr = _new_manager(client, admin, "Atomic")
    seller_id = _new_seller(client, mgr)
    client.post("/api/v1/loans/", headers=mgr, json={"seller_id": seller_id, "date": "2026-10-01", "loan_taken": 100})

    txn_id = _approved_cocoa(client, mgr, seller_id)
    resp = client.post(f"/api/v1/cocoa/{txn_id}/issue-receipt?loan_deduction=200", headers=mgr)
    assert resp.status_code == 400
    assert "outstanding" in resp.json()["detail"]

    # Rolled back as a unit: still APPROVED, no receipt, no repayment
    assert client.get(f"/api/v1/cocoa/{txn_id}", headers=mgr).json()["status"] == "approved"
    db.expire_all()
    assert db.query(Receipt).filter(Receipt.transaction_id == uuid.UUID(txn_id)).count() == 0
    loan = db.query(Loan).filter(Loan.seller_id == uuid.UUID(seller_id)).one()
    assert db.query(LoanRepayment).filter(LoanRepayment.loan_id == loan.id).count() == 0

    # Negative deductions are rejected by validation
    assert client.post(f"/api/v1/cocoa/{txn_id}/issue-receipt?loan_deduction=-50", headers=mgr).status_code == 422

    # A valid issue still works afterwards, exactly once
    assert client.post(f"/api/v1/cocoa/{txn_id}/issue-receipt", headers=mgr).status_code == 200
    assert client.post(f"/api/v1/cocoa/{txn_id}/issue-receipt", headers=mgr).status_code == 400


def test_repayment_cannot_exceed_balance(client):
    admin = _login(client, ADMIN_CONTACT, ADMIN_PASSWORD)
    mgr = _new_manager(client, admin, "Repay")
    seller_id = _new_seller(client, mgr)
    loan = client.post("/api/v1/loans/", headers=mgr, json={"seller_id": seller_id, "date": "2026-10-01", "loan_taken": 100}).json()
    resp = client.post("/api/v1/loans/repayments", headers=mgr, json={"loan_id": loan["id"], "date": "2026-10-02", "amount_paid": 150})
    assert resp.status_code == 400
    resp = client.post("/api/v1/loans/repayments", headers=mgr, json={"loan_id": loan["id"], "date": "2026-10-02", "amount_paid": 100})
    assert resp.json() == {"balance": 0.0, "status": "cleared"}


def test_money_is_stored_exactly_and_returned_as_numbers(client, db):
    admin = _login(client, ADMIN_CONTACT, ADMIN_PASSWORD)
    mgr = _new_manager(client, admin, "Exact")
    seller_id = _new_seller(client, mgr)
    # 3 kg x 0.10 = 0.30 exactly (float math would give 0.30000000000000004)
    resp = client.post("/api/v1/cola/", headers=mgr, json={
        "seller_id": seller_id, "date": "2026-11-02", "weight_kg": 3, "price_per_kg": 0.1,
    })
    assert resp.status_code == 201
    assert resp.json()["total_price"] == 0.3
    txn_id = resp.json()["id"]
    client.post(f"/api/v1/cola/{txn_id}/approve", headers=mgr)
    client.post(f"/api/v1/cola/{txn_id}/issue-receipt", headers=mgr)

    receipt = db.query(Receipt).filter(Receipt.transaction_id == uuid.UUID(txn_id)).one()
    assert receipt.gross_amount == Decimal("0.30")

    # JSON stays numeric (not strings) so the frontend's arithmetic keeps working
    dash = client.get("/api/v1/dashboard/summary", headers=mgr).json()
    report = client.get("/api/v1/reports/produce", headers=mgr).json()
    assert isinstance(report["total_value_nle"], (int, float))
    assert not any(isinstance(v, str) and v.replace(".", "").isdigit() for v in dash.values())


def test_supply_value_computed_from_price(client):
    admin = _login(client, ADMIN_CONTACT, ADMIN_PASSWORD)
    mgr = _new_manager(client, admin, "Supply")
    resp = client.post("/api/v1/supplies/", headers=mgr, json={
        "commodity": "cocoa", "total_kg": 1000.5, "total_bags": 15, "water_percent": 7.0,
        "company_name": "Buyer Ltd", "witness_name": "W", "price_per_kg": 45.1,
    })
    assert resp.status_code == 201, resp.text
    assert resp.json()["total_value"] == 45122.55


def test_seed_never_creates_a_default_admin(db, monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, "ADMIN_EMAIL", None)
    monkeypatch.setattr(settings, "ADMIN_PASSWORD", None)
    seed_database(db)
    assert db.query(User).filter(User.contact == "admin@comis.local").first() is None


def test_seed_suspends_legacy_default_admin(db):
    legacy = User(name="Old Admin", contact="admin@comis.local", password_hash=hash_password("ComisAdmin2024!"),
                  role=UserRole.system_admin, status=UserStatus.active)
    db.add(legacy)
    db.commit()
    seed_database(db)
    db.refresh(legacy)
    assert legacy.status == UserStatus.suspended
    # The configured admin is unaffected
    admin = db.query(User).filter(User.contact == ADMIN_CONTACT).one()
    assert admin.status == UserStatus.active and verify_password(ADMIN_PASSWORD, admin.password_hash)
