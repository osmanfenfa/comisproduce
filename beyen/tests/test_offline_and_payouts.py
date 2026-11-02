"""Offline-queue idempotency and the (inactive) Orange Money payout placeholder."""
import uuid
from tests.test_station_sync import _business


def test_offline_retry_with_same_client_ref_is_not_duplicated(client):
    mgr, sec, _, seller_id = _business(client)
    ref = f"dev-{uuid.uuid4()}"
    body = {"seller_id": seller_id, "date": "2026-11-02", "weight_kg": 10, "bags": 1,
            "price_per_kg": 20, "client_ref": ref}

    first = client.post("/api/v1/cola/", headers=sec, json=body)
    again = client.post("/api/v1/cola/", headers=sec, json=body)   # connection dropped; queue retries
    assert first.status_code == 201 and again.status_code == 201
    assert first.json()["id"] == again.json()["id"]
    mine = [t for t in client.get("/api/v1/cola/", headers=sec).json() if t["id"] == first.json()["id"]]
    assert len(mine) == 1

    # Another user can't reuse (or probe) someone else's reference
    assert client.post("/api/v1/cola/", headers=mgr, json=body).status_code == 409


def test_orange_money_is_listed_but_inactive(client):
    mgr, _, _, _ = _business(client)
    providers = {p["id"]: p for p in client.get("/api/v1/payouts/providers", headers=mgr).json()}
    assert providers["cash"]["available"] is True
    assert providers["orange_money"]["available"] is False
    assert providers["orange_money"]["status"] == "coming_soon"
    assert client.post("/api/v1/payouts/orange-money", headers=mgr).status_code == 501
