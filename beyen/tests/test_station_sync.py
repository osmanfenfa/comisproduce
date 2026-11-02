"""End-of-day station sync rules and the merged commodity workflow."""
import uuid
from tests.conftest import ADMIN_CONTACT, ADMIN_PASSWORD


def _login(client, contact, password):
    resp = client.post("/api/v1/auth/login", json={"contact": contact, "password": password})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def _business(client):
    """A manager with two secretaries at different stations, and one seller."""
    admin = _login(client, ADMIN_CONTACT, ADMIN_PASSWORD)
    tag = uuid.uuid4().hex[:6]
    mgr_contact = f"mgr.{tag}@example.com"
    mid = client.post("/api/v1/users/managers", json={
        "name": "Sync Manager", "contact": mgr_contact, "password": "Password123!",
        "business_name": "Sync Produce", "station_name": "Sync HQ",
    }).json()["id"]
    client.post(f"/api/v1/users/{mid}/approve", headers=admin)
    mgr = _login(client, mgr_contact, "Password123!")
    secs = []
    for station in ("Kenema Station", "Bo Station"):
        contact = f"sec.{station.split()[0].lower()}.{tag}@example.com"
        r = client.post("/api/v1/users/secretaries", headers=mgr, json={
            "name": f"Sec {station}", "contact": contact, "password": "Password123!", "station_name": station,
        })
        assert r.status_code == 201, r.text
        secs.append(_login(client, contact, "Password123!"))
    seller_id = client.post("/api/v1/sellers/", headers=mgr, json={
        "name": "Sync Seller", "gender": "male", "address": "A", "chiefdom": "Nongowa", "district": "Kenema",
    }).json()["id"]
    return mgr, secs[0], secs[1], seller_id


def _cola(client, headers, seller_id, bags=3):
    r = client.post("/api/v1/cola/", headers=headers, json={
        "seller_id": seller_id, "date": "2026-11-02", "weight_kg": 10, "bags": bags, "price_per_kg": 20,
    })
    assert r.status_code == 201, r.text
    return r.json()


def test_manager_purchases_are_visible_immediately(client):
    mgr, _, _, seller_id = _business(client)
    txn = _cola(client, mgr, seller_id)
    assert txn["synced_at"] is not None
    assert txn["bags"] == 3   # cola used to drop the bag count
    assert client.get(f"/api/v1/cola/{txn['id']}", headers=mgr).status_code == 200


def test_secretary_day_is_private_until_synced(client):
    mgr, sec_kenema, sec_bo, seller_id = _business(client)
    txn = _cola(client, sec_kenema, seller_id)
    client.post(f"/api/v1/cola/{txn['id']}/approve", headers=sec_kenema)
    receipt = client.post(f"/api/v1/cola/{txn['id']}/issue-receipt", headers=sec_kenema).json()

    # Manager: not in lists, details 404, receipt hidden, reports exclude it
    assert client.get(f"/api/v1/cola/{txn['id']}", headers=mgr).status_code == 404
    assert client.get(f"/api/v1/receipts/{receipt['id']}", headers=mgr).status_code == 404
    assert client.get("/api/v1/reports/produce", headers=mgr).json()["count"] == 0
    assert client.get("/api/v1/dashboard/summary", headers=mgr).json()["unsynced_station_purchases"] == 1

    # Another station's secretary can't see or act on it, and syncing their own day doesn't include it
    assert client.get(f"/api/v1/cola/{txn['id']}", headers=sec_bo).status_code == 403
    assert client.post("/api/v1/sync/", headers=sec_bo).json()["synced_purchases"] == 0

    assert client.post("/api/v1/sync/", headers=sec_kenema).json()["synced_purchases"] == 1
    assert client.get(f"/api/v1/receipts/{receipt['id']}", headers=mgr).status_code == 200
    assert client.get("/api/v1/reports/produce", headers=mgr).json()["count"] == 1

    # After sync the purchase is the Manager's: the secretary can't edit the outcome any more
    r = client.post(f"/api/v1/cola/{txn['id']}/reject", headers=sec_kenema, json={"reason": "x"})
    assert r.status_code == 403


def test_sync_endpoints_are_role_restricted(client):
    mgr, sec, _, _ = _business(client)
    assert client.post("/api/v1/sync/", headers=mgr).status_code == 403
    assert client.get("/api/v1/sync/summary", headers=mgr).status_code == 403
    assert client.get("/api/v1/sync/status", headers=sec).status_code == 403
