"""Market identity verification: ID / passport photo, number read from the photo, admin review."""
import uuid
from app.services import id_document
from tests.conftest import ADMIN_CONTACT, ADMIN_PASSWORD
from tests.test_marketplace import _signup, _login, JPEG, SENT_SMS_BUFFER

# ICAO 9303 specimen passport (Anna Maria Eriksson): document number L898902C3, check digit 6
PASSPORT_MRZ = [
    "PASSPORT", "Surname ERIKSSON",
    "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<",
    "L898902C36UTO7408122F1204159ZE184226B<<<<<10",
]


def test_mrz_check_digit_and_passport_number():
    assert id_document.mrz_check_digit("L898902C3") == 6
    mrz = id_document._mrz_candidates(PASSPORT_MRZ)
    assert id_document._passport_from_mrz(mrz) == "L898902C3"
    # A misread character fails the check digit and is not trusted
    bad = id_document._mrz_candidates(["L898902C46UTO7408122F1204159ZE184226B<<<<<10"])
    assert id_document._passport_from_mrz(bad) is None


def test_nin_read_next_to_label(monkeypatch):
    lines = ["REPUBLIC OF SIERRA LEONE", "NATIONAL IDENTITY CARD", "Surname KAMARA",
             "NIN: 4Y7K-2M9Q", "Date of Birth 01.01.1990"]
    monkeypatch.setattr(id_document, "_ocr_lines", lambda p: lines)
    assert id_document.extract_number("nin", "x.jpg").number == "4Y7K2M9Q"
    # Label on one line, number on the next
    monkeypatch.setattr(id_document, "_ocr_lines", lambda p: ["National Identification Number", "AB123456"])
    assert id_document.extract_number("nin", "x.jpg").number == "AB123456"
    # Nothing readable: no number, the member types it
    monkeypatch.setattr(id_document, "_ocr_lines", lambda p: ["blurry"])
    assert id_document.extract_number("nin", "x.jpg").number is None
    monkeypatch.setattr(id_document, "_ocr_lines", lambda p: None)
    assert id_document.extract_number("passport", "x.jpg").ocr_available is False


def _verify_phone(client, headers):
    SENT_SMS_BUFFER.clear()
    client.post("/api/v1/market/me/verify-phone/send", headers=headers)
    code = SENT_SMS_BUFFER[-1]["message"].split("code is ")[1][:6]
    assert client.post("/api/v1/market/me/verify-phone/confirm", headers=headers, json={"code": code}).status_code == 200


def test_full_id_verification_flow(client, monkeypatch):
    monkeypatch.setattr(id_document, "_ocr_lines", lambda p: PASSPORT_MRZ)
    farmer, _, _ = _signup(client)

    r = client.post("/api/v1/market/me/id-document", headers=farmer,
                    data={"doc_type": "passport"}, files={"file": ("p.jpg", JPEG, "image/jpeg")})
    assert r.status_code == 200, r.text
    assert r.json()["number_read"] == "L898902C3" and r.json()["method"] == "mrz"

    # The photo is private: owner yes, others no, never under /media
    assert client.get("/api/v1/market/me/id-document/image", headers=farmer).status_code == 200
    other, _, _ = _signup(client, "trader")
    me = client.get("/api/v1/market/me", headers=farmer).json()
    assert client.get(f"/api/v1/market/admin/verifications/{me['id']}/image", headers=other).status_code == 403

    me = client.post("/api/v1/market/me/id-document/confirm", headers=farmer, json={"doc_number": "l898902c3"}).json()
    assert me["id_status"] == "pending" and me["id_doc_number"] == "L898902C3" and me["verified"] is False

    admin = _login(client, ADMIN_CONTACT, ADMIN_PASSWORD)
    pending = client.get("/api/v1/market/admin/verifications", headers=admin).json()
    item = next(v for v in pending if v["user_id"] == me["id"])
    assert item["number_edited"] is False and item["doc_type"] == "passport"
    assert client.get(f"/api/v1/market/admin/verifications/{me['id']}/image", headers=admin).status_code == 200
    assert client.post(f"/api/v1/market/admin/verifications/{me['id']}/approve", headers=admin).json()["status"] == "verified"

    # Verified = approved ID + phone code
    assert client.get("/api/v1/market/me", headers=farmer).json()["verified"] is False
    _verify_phone(client, farmer)
    assert client.get("/api/v1/market/me", headers=farmer).json()["verified"] is True
    post = client.post("/api/v1/market/listings", headers=farmer, json={
        "category": "rice", "title": "Verified seller rice", "district": "Bo"}).json()
    assert post["owner"]["verified"] is True

    # The same passport can't verify a second account
    client.post("/api/v1/market/me/id-document", headers=other,
                data={"doc_type": "passport"}, files={"file": ("p.jpg", JPEG, "image/jpeg")})
    r = client.post("/api/v1/market/me/id-document/confirm", headers=other, json={"doc_number": "L898902C3"})
    assert r.status_code == 409


def test_manual_number_and_rejection(client, monkeypatch):
    monkeypatch.setattr(id_document, "_ocr_lines", lambda p: None)   # no OCR engine
    trader, _, _ = _signup(client, "trader")
    r = client.post("/api/v1/market/me/id-document", headers=trader,
                    data={"doc_type": "nin"}, files={"file": ("id.jpg", JPEG, "image/jpeg")}).json()
    assert r["number_read"] is None and r["ocr_available"] is False
    nin = "SL" + uuid.uuid4().hex[:6].upper()
    me = client.post("/api/v1/market/me/id-document/confirm", headers=trader, json={"doc_number": nin}).json()
    assert me["id_status"] == "pending"

    admin = _login(client, ADMIN_CONTACT, ADMIN_PASSWORD)
    item = next(v for v in client.get("/api/v1/market/admin/verifications", headers=admin).json() if v["user_id"] == me["id"])
    assert item["number_edited"] is True            # typed by the member: admin compares with the photo
    assert client.post(f"/api/v1/market/admin/verifications/{me['id']}/reject", headers=admin).status_code == 400
    r = client.post(f"/api/v1/market/admin/verifications/{me['id']}/reject", headers=admin,
                    json={"reason": "Photo is blurred, upload again"})
    assert r.json()["status"] == "rejected"
    me = client.get("/api/v1/market/me", headers=trader).json()
    assert me["id_status"] == "rejected" and "blurred" in me["id_reject_reason"]

    # Non-images are refused; members can upload again after a rejection
    assert client.post("/api/v1/market/me/id-document", headers=trader, data={"doc_type": "nin"},
                       files={"file": ("id.pdf", b"%PDF-1.4 fake", "application/pdf")}).status_code == 400
    assert client.post("/api/v1/market/me/id-document", headers=trader, data={"doc_type": "nin"},
                       files={"file": ("id.jpg", JPEG, "image/jpeg")}).status_code == 200
