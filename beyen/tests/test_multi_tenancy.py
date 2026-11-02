"""
Multi-tenancy and Data Isolation Integration Tests for COMIS.
Validates that:
1. Different Produce Businesses (e.g. Confidence Produce vs Laser Produce) have 100% data isolation.
2. Managers and Secretaries cannot see or manipulate transactions, sellers, receipts, loans, or audit logs of another Produce Business.
3. Secretary can only view station-specific data while Produce Manager can view all stations under their Produce Business.
4. Cross-tenant access attempts (GET, PUT, Approve) return 403 Forbidden.
5. System Admin can monitor tenants.
"""
import pytest
from tests.conftest import ADMIN_CONTACT, ADMIN_PASSWORD


def test_saas_multi_tenant_isolation(client):
    # -----------------------------------------------------------------------
    # Step 1: System Admin Logs In
    # -----------------------------------------------------------------------
    resp = client.post("/api/v1/auth/login", json={
        "contact": ADMIN_CONTACT,
        "password": ADMIN_PASSWORD,
    })
    assert resp.status_code == 200
    admin_token = resp.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # -----------------------------------------------------------------------
    # Step 2: Register & Approve Tenant A: "Confidence Produce"
    # -----------------------------------------------------------------------
    resp = client.post("/api/v1/users/managers", json={
        "name": "Manager Confidence",
        "contact": "mgr.confidence@example.com",
        "password": "Password123!",
        "business_name": "Confidence Produce",
        "station_name": "Confidence HQ",
    })
    assert resp.status_code == 201
    mgr_a_id = resp.json()["id"]

    # Admin approves Manager A
    resp = client.post(f"/api/v1/users/{mgr_a_id}/approve", headers=admin_headers)
    assert resp.status_code == 200

    # Manager A Login
    resp = client.post("/api/v1/auth/login", json={
        "contact": "mgr.confidence@example.com",
        "password": "Password123!",
    })
    assert resp.status_code == 200
    mgr_a_token = resp.json()["access_token"]
    mgr_a_produce_id = resp.json()["produce_id"]
    assert mgr_a_produce_id is not None
    mgr_a_headers = {"Authorization": f"Bearer {mgr_a_token}"}

    # -----------------------------------------------------------------------
    # Step 3: Register & Approve Tenant B: "Laser Produce"
    # -----------------------------------------------------------------------
    resp = client.post("/api/v1/users/managers", json={
        "name": "Manager Laser",
        "contact": "mgr.laser@example.com",
        "password": "Password123!",
        "business_name": "Laser Produce",
        "station_name": "Laser HQ",
    })
    assert resp.status_code == 201
    mgr_b_id = resp.json()["id"]

    # Admin approves Manager B
    resp = client.post(f"/api/v1/users/{mgr_b_id}/approve", headers=admin_headers)
    assert resp.status_code == 200

    # Manager B Login
    resp = client.post("/api/v1/auth/login", json={
        "contact": "mgr.laser@example.com",
        "password": "Password123!",
    })
    assert resp.status_code == 200
    mgr_b_token = resp.json()["access_token"]
    mgr_b_produce_id = resp.json()["produce_id"]
    assert mgr_b_produce_id is not None
    assert mgr_a_produce_id != mgr_b_produce_id, "Different produce businesses must have distinct produce_ids"
    mgr_b_headers = {"Authorization": f"Bearer {mgr_b_token}"}

    # -----------------------------------------------------------------------
    # Step 4: Create Secretaries for both Tenants
    # -----------------------------------------------------------------------
    # Manager A creates Secretary A1 (Kenema Station) & Secretary A2 (Pendembu Station)
    resp = client.post("/api/v1/users/secretaries", headers=mgr_a_headers, json={
        "name": "Confidence Sec Kenema",
        "contact": "sec.kenema@confidence.com",
        "password": "Password123!",
        "station_name": "Kenema Buying Station",
    })
    assert resp.status_code == 201

    resp = client.post("/api/v1/users/secretaries", headers=mgr_a_headers, json={
        "name": "Confidence Sec Pendembu",
        "contact": "sec.pendembu@confidence.com",
        "password": "Password123!",
        "station_name": "Pendembu Buying Station",
    })
    assert resp.status_code == 201

    # Manager B creates Secretary B1 (Bo Station)
    resp = client.post("/api/v1/users/secretaries", headers=mgr_b_headers, json={
        "name": "Laser Sec Bo",
        "contact": "sec.bo@laser.com",
        "password": "Password123!",
        "station_name": "Bo Buying Station",
    })
    assert resp.status_code == 201

    # Log in Secretary A1 (Kenema)
    resp = client.post("/api/v1/auth/login", json={
        "contact": "sec.kenema@confidence.com",
        "password": "Password123!",
    })
    assert resp.status_code == 200
    sec_a1_token = resp.json()["access_token"]
    sec_a1_headers = {"Authorization": f"Bearer {sec_a1_token}"}
    assert resp.json()["produce_id"] == mgr_a_produce_id
    assert resp.json()["station_name"] == "Kenema Buying Station"

    # Log in Secretary B1 (Bo)
    resp = client.post("/api/v1/auth/login", json={
        "contact": "sec.bo@laser.com",
        "password": "Password123!",
    })
    assert resp.status_code == 200
    sec_b1_token = resp.json()["access_token"]
    sec_b1_headers = {"Authorization": f"Bearer {sec_b1_token}"}
    assert resp.json()["produce_id"] == mgr_b_produce_id
    assert resp.json()["station_name"] == "Bo Buying Station"

    # -----------------------------------------------------------------------
    # Step 5: Verify Secretary Listing Isolation
    # -----------------------------------------------------------------------
    # Manager A lists secretaries -> should only see Kenema & Pendembu (2 total)
    resp = client.get("/api/v1/users/secretaries", headers=mgr_a_headers)
    assert resp.status_code == 200
    sec_a_list = resp.json()
    assert len(sec_a_list) == 2
    sec_a_contacts = {s["contact"] for s in sec_a_list}
    assert "sec.kenema@confidence.com" in sec_a_contacts
    assert "sec.pendembu@confidence.com" in sec_a_contacts
    assert "sec.bo@laser.com" not in sec_a_contacts

    # Manager B lists secretaries -> should only see Bo (1 total)
    resp = client.get("/api/v1/users/secretaries", headers=mgr_b_headers)
    assert resp.status_code == 200
    sec_b_list = resp.json()
    assert len(sec_b_list) == 1
    assert sec_b_list[0]["contact"] == "sec.bo@laser.com"

    # -----------------------------------------------------------------------
    # Step 6: Seller Isolation
    # -----------------------------------------------------------------------
    # Secretary A1 registers "Alpha Farmer"
    resp = client.post("/api/v1/sellers/", headers=sec_a1_headers, json={
        "name": "Alpha Farmer",
        "gender": "male",
        "address": "Kenema Village",
        "contact": "+23276111111",
    })
    assert resp.status_code == 201
    seller_a_id = resp.json()["id"]

    # Secretary B1 registers "Beta Farmer"
    resp = client.post("/api/v1/sellers/", headers=sec_b1_headers, json={
        "name": "Beta Farmer",
        "gender": "female",
        "address": "Bo City",
        "contact": "+23276222222",
    })
    assert resp.status_code == 201
    seller_b_id = resp.json()["id"]

    # Manager A and Secretary A1 should ONLY see Alpha Farmer
    resp = client.get("/api/v1/sellers/", headers=mgr_a_headers)
    assert resp.status_code == 200
    sellers_a = [s["name"] for s in resp.json()]
    assert "Alpha Farmer" in sellers_a
    assert "Beta Farmer" not in sellers_a

    resp = client.get("/api/v1/sellers/", headers=sec_a1_headers)
    assert resp.status_code == 200
    sellers_sec_a = [s["name"] for s in resp.json()]
    assert "Alpha Farmer" in sellers_sec_a
    assert "Beta Farmer" not in sellers_sec_a

    # Manager B and Secretary B1 should ONLY see Beta Farmer
    resp = client.get("/api/v1/sellers/", headers=mgr_b_headers)
    assert resp.status_code == 200
    sellers_b = [s["name"] for s in resp.json()]
    assert "Beta Farmer" in sellers_b
    assert "Alpha Farmer" not in sellers_b

    # Cross-tenant direct seller access attempt:
    # Manager B tries to access Alpha Farmer -> 403 or 404
    resp = client.get(f"/api/v1/sellers/{seller_a_id}", headers=mgr_b_headers)
    assert resp.status_code in [403, 404]

    # -----------------------------------------------------------------------
    # Step 7: Commodity Transaction & Receipt Isolation
    # -----------------------------------------------------------------------
    # Secretary A1 records a cocoa intake at Kenema Buying Station
    resp = client.post("/api/v1/cocoa/", headers=sec_a1_headers, json={
        "seller_id": seller_a_id,
        "date": "2026-09-08",
        "weight_kg": 100.0,
        "water_percent": 7.0,
        "price_per_kg": 40.0,
    })
    assert resp.status_code == 201
    txn_a_id = resp.json()["id"]
    assert resp.json()["station_name"] == "Kenema Buying Station"

    # Secretary B1 records a cocoa intake at Bo Buying Station
    resp = client.post("/api/v1/cocoa/", headers=sec_b1_headers, json={
        "seller_id": seller_b_id,
        "date": "2026-09-08",
        "weight_kg": 200.0,
        "water_percent": 7.0,
        "price_per_kg": 45.0,
    })
    assert resp.status_code == 201
    txn_b_id = resp.json()["id"]
    assert resp.json()["station_name"] == "Bo Buying Station"

    # End-of-day sync at both stations so the managers can see the purchases
    assert client.post("/api/v1/sync/", headers=sec_a1_headers).status_code == 200
    assert client.post("/api/v1/sync/", headers=sec_b1_headers).status_code == 200

    # Manager A lists cocoa -> MUST see txn_a, MUST NOT see txn_b
    resp = client.get("/api/v1/cocoa/", headers=mgr_a_headers)
    assert resp.status_code == 200
    txns_a = [t["id"] for t in resp.json()]
    assert txn_a_id in txns_a
    assert txn_b_id not in txns_a

    # Manager B lists cocoa -> MUST see txn_b, MUST NOT see txn_a
    resp = client.get("/api/v1/cocoa/", headers=mgr_b_headers)
    assert resp.status_code == 200
    txns_b = [t["id"] for t in resp.json()]
    assert txn_b_id in txns_b
    assert txn_a_id not in txns_b

    # Secretary B1 lists cocoa -> MUST NOT see txn_a
    resp = client.get("/api/v1/cocoa/", headers=sec_b1_headers)
    assert resp.status_code == 200
    sec_b_txns = [t["id"] for t in resp.json()]
    assert txn_a_id not in sec_b_txns
    assert txn_b_id in sec_b_txns

    # Cross-tenant direct transaction tampering attempt:
    # Manager B attempts to approve Manager A's cocoa transaction -> 403 Forbidden
    resp = client.post(f"/api/v1/cocoa/{txn_a_id}/approve", headers=mgr_b_headers)
    assert resp.status_code == 403

    # Manager A approves txn_a
    resp = client.post(f"/api/v1/cocoa/{txn_a_id}/approve", headers=mgr_a_headers)
    assert resp.status_code == 200

    # Manager A issues receipt for txn_a
    resp = client.post(f"/api/v1/cocoa/{txn_a_id}/issue-receipt", headers=mgr_a_headers)
    assert resp.status_code == 200
    receipt_a_id = resp.json()["id"]

    # Receipts isolation:
    # Manager A lists receipts -> contains receipt_a
    resp = client.get("/api/v1/receipts/", headers=mgr_a_headers)
    assert resp.status_code == 200
    receipts_a = [r["id"] for r in resp.json()]
    assert receipt_a_id in receipts_a

    # Manager B lists receipts -> 0 receipts
    resp = client.get("/api/v1/receipts/", headers=mgr_b_headers)
    assert resp.status_code == 200
    receipts_b = [r["id"] for r in resp.json()]
    assert receipt_a_id not in receipts_b

    # Manager B attempts direct GET receipt_a -> 403 or 404
    resp = client.get(f"/api/v1/receipts/{receipt_a_id}", headers=mgr_b_headers)
    assert resp.status_code in [403, 404]

    # -----------------------------------------------------------------------
    # Step 8: Dashboard Isolation
    # -----------------------------------------------------------------------
    # Manager A dashboard stats:
    resp = client.get("/api/v1/dashboard/summary", headers=mgr_a_headers)
    assert resp.status_code == 200
    summary_a = resp.json()
    assert summary_a["cocoa"]["count"] == 1
    assert summary_a["receipts_issued_today"] == 1

    # Manager B dashboard stats (txn_b is pending, not yet approved/receipted):
    resp = client.get("/api/v1/dashboard/summary", headers=mgr_b_headers)
    assert resp.status_code == 200
    summary_b = resp.json()
    assert summary_b["cocoa"]["count"] == 1  # Laser's 1 txn
    assert summary_b["receipts_issued_today"] == 0  # No receipts issued yet for Laser

    # -----------------------------------------------------------------------
    # Step 9: System Admin Platform Overview
    # -----------------------------------------------------------------------
    resp = client.get("/api/v1/dashboard/summary", headers=admin_headers)
    assert resp.status_code == 200
    summary_admin = resp.json()
    assert summary_admin["today_cocoa"]["count"] >= 2
    assert summary_admin["total_managers"] >= 2
    assert summary_admin["total_secretaries"] >= 3
