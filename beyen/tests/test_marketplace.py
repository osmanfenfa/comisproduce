"""COMIS Market: farmer/trader accounts, listings, media, offers, moderation, farmer records."""
import uuid
from tests.conftest import ADMIN_CONTACT, ADMIN_PASSWORD
from app.services.sms import SENT_SMS_BUFFER

JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 200
MP4 = b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 200


def _login(client, contact, password="Password123!"):
    r = client.post("/api/v1/auth/login", json={"contact": contact, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _phone():
    return "07" + str(uuid.uuid4().int)[:7]          # 9 digits, e.g. 07xxxxxxx


def _signup(client, account_type="farmer", phone=None, name="Fatu Kamara"):
    phone = phone or _phone()
    r = client.post("/api/v1/market/signup", json={
        "account_type": account_type, "name": name, "phone": phone, "password": "Password123!",
        "district": "kenema", "chiefdom": "Nongowa", "terms_accepted": True,
    })
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}, phone, r.json()


def _listing(client, headers, **kw):
    body = {"kind": "sell", "category": "rice", "title": "Local rice, 10 bags", "quantity": 10, "unit": "bag",
            "price": 450, "district": "Kenema", "chiefdom": "Nongowa"}
    body.update(kw)
    r = client.post("/api/v1/market/listings", headers=headers, json=body)
    assert r.status_code == 201, r.text
    return r.json()


def test_farmer_and_trader_signup_and_phone_login(client):
    farmer, phone, token = _signup(client, "farmer")
    assert token["role"] == "farmer" and token["produce_id"] is None

    # Log in with the number written differently
    _login(client, "+232 " + phone[1:])
    _login(client, phone)

    # Same number can't register twice
    r = client.post("/api/v1/market/signup", json={
        "account_type": "trader", "name": "Dup", "phone": "+232" + phone[1:], "password": "Password123!",
        "district": "Bo", "terms_accepted": True,
    })
    assert r.status_code == 409

    trader, _, t = _signup(client, "trader", name="Mohamed Traders")
    assert t["role"] == "trader"
    me = client.get("/api/v1/market/me", headers=trader).json()
    assert me["district"] == "Kenema" and me["phone_verified"] is False


def test_signup_validation(client):
    base = {"account_type": "farmer", "name": "X Y", "password": "Password123!", "district": "Kenema",
            "terms_accepted": True}
    assert client.post("/api/v1/market/signup", json={**base, "phone": "12345"}).status_code == 400
    assert client.post("/api/v1/market/signup", json={**base, "phone": _phone(), "district": "Atlantis"}).status_code == 400
    assert client.post("/api/v1/market/signup", json={**base, "phone": _phone(), "terms_accepted": False}).status_code == 400
    assert client.post("/api/v1/market/signup", json={**base, "phone": _phone(), "account_type": "system_admin"}).status_code == 422


def test_market_users_cannot_reach_station_data(client):
    farmer, _, _ = _signup(client)
    for path in ("/api/v1/cocoa/", "/api/v1/sellers/", "/api/v1/receipts/", "/api/v1/loans/",
                 "/api/v1/dashboard/summary", "/api/v1/reports/produce", "/api/v1/users/me"):
        assert client.get(path, headers=farmer).status_code == 403, path


def test_listing_media_and_browse(client):
    farmer, _, _ = _signup(client)
    listing = _listing(client, farmer, title=f"Cassava {uuid.uuid4().hex[:5]}", category="cassava")
    lid = listing["id"]

    r = client.post(f"/api/v1/market/listings/{lid}/media", headers=farmer, files={"file": ("a.jpg", JPEG, "image/jpeg")})
    assert r.status_code == 201 and r.json()["kind"] == "photo"
    photo_url = r.json()["url"]
    assert client.get(photo_url).status_code == 200

    r = client.post(f"/api/v1/market/listings/{lid}/media", headers=farmer, files={"file": ("v.mp4", MP4, "video/mp4")})
    assert r.status_code == 201 and r.json()["kind"] == "video"
    # Only one video per listing
    r = client.post(f"/api/v1/market/listings/{lid}/media", headers=farmer, files={"file": ("v2.mp4", MP4, "video/mp4")})
    assert r.status_code == 400

    # Files are checked by content, not by name
    r = client.post(f"/api/v1/market/listings/{lid}/media", headers=farmer,
                    files={"file": ("evil.jpg", b"<script>alert(1)</script>", "image/jpeg")})
    assert r.status_code == 400

    trader, _, _ = _signup(client, "trader")
    found = client.get("/api/v1/market/listings", headers=trader, params={"category": "cassava", "district": "kenema"}).json()
    match = next(l for l in found if l["id"] == lid)
    assert len(match["media"]) == 2 and match["is_mine"] is False

    # Only the owner can change it
    assert client.post(f"/api/v1/market/listings/{lid}/media", headers=trader,
                       files={"file": ("a.jpg", JPEG, "image/jpeg")}).status_code == 403
    assert client.delete(f"/api/v1/market/listings/{lid}", headers=trader).status_code == 403


def test_offers_and_contact_reveal(client):
    farmer, farmer_phone, _ = _signup(client)
    trader, _, _ = _signup(client, "trader")
    lid = _listing(client, farmer)["id"]

    assert client.post(f"/api/v1/market/listings/{lid}/offers", headers=farmer, json={}).status_code == 400

    r = client.post(f"/api/v1/market/listings/{lid}/offers", headers=trader,
                    json={"quantity": 5, "price": 430, "message": "Can collect Friday"})
    assert r.status_code == 201
    offer = r.json()
    assert offer["counterpart_phone"] is None
    assert client.post(f"/api/v1/market/listings/{lid}/offers", headers=trader, json={}).status_code == 409

    # Buyer can't accept their own offer; owner can
    assert client.post(f"/api/v1/market/offers/{offer['id']}/accept", headers=trader).status_code == 403
    received = client.get("/api/v1/market/offers", headers=farmer, params={"box": "received"}).json()
    assert any(o["id"] == offer["id"] for o in received)
    r = client.post(f"/api/v1/market/offers/{offer['id']}/accept", headers=farmer)
    assert r.status_code == 200 and r.json()["status"] == "accepted"
    assert r.json()["counterpart_phone"]                          # farmer now sees the trader's number

    sent = client.get("/api/v1/market/offers", headers=trader, params={"box": "sent"}).json()
    mine = next(o for o in sent if o["id"] == offer["id"])
    assert mine["counterpart_phone"] == "+232" + farmer_phone[1:]

    # Farmer-to-farmer trades work the same way, and so do supply offers on "wanted" posts
    other_farmer, _, _ = _signup(client)
    wanted = _listing(client, trader, kind="wanted", title="Need 2 tons palm kernels", category="palm_oil", unit="ton")
    r = client.post(f"/api/v1/market/listings/{wanted['id']}/offers", headers=other_farmer, json={"quantity": 1})
    assert r.status_code == 201

    # Sold listings no longer take offers
    client.post(f"/api/v1/market/listings/{lid}/status", headers=farmer, json={"status": "sold"})
    assert client.post(f"/api/v1/market/listings/{lid}/offers", headers=other_farmer, json={}).status_code == 400


def test_station_manager_can_use_market(client):
    admin = _login(client, ADMIN_CONTACT, ADMIN_PASSWORD)
    tag = uuid.uuid4().hex[:6]
    mid = client.post("/api/v1/users/managers", json={
        "name": "M", "contact": f"m.{tag}@x.com", "password": "Password123!", "business_name": "Station"}).json()["id"]
    client.post(f"/api/v1/users/{mid}/approve", headers=admin)
    mgr = _login(client, f"m.{tag}@x.com")
    _listing(client, mgr, kind="wanted", category="cocoa", title="Buying dry cocoa, any quantity")
    assert client.get("/api/v1/market/listings", headers=mgr).status_code == 200
    # Admin can browse but not trade
    assert client.get("/api/v1/market/listings", headers=admin).status_code == 200
    assert client.post("/api/v1/market/listings", headers=admin, json={}).status_code == 403


def test_report_and_moderation(client):
    farmer, _, _ = _signup(client)
    trader, _, _ = _signup(client, "trader")
    lid = _listing(client, farmer, title=f"Suspicious {uuid.uuid4().hex[:5]}")["id"]
    assert client.post(f"/api/v1/market/listings/{lid}/report", headers=trader,
                       json={"reason": "Fake photos, scam"}).status_code == 201

    admin = _login(client, ADMIN_CONTACT, ADMIN_PASSWORD)
    assert client.get("/api/v1/market/admin/reports", headers=trader).status_code == 403
    reports = client.get("/api/v1/market/admin/reports", headers=admin).json()
    assert any(r["listing_id"] == lid for r in reports)
    assert client.post(f"/api/v1/market/admin/listings/{lid}/remove", headers=admin).status_code == 200

    assert lid not in [l["id"] for l in client.get("/api/v1/market/listings", headers=trader).json()]
    assert client.get(f"/api/v1/market/listings/{lid}", headers=trader).status_code == 404
    assert client.put(f"/api/v1/market/listings/{lid}", headers=farmer, json={
        "category": "rice", "title": "Back again", "district": "Kenema"}).status_code == 403


def test_farmer_sees_station_records_after_phone_verification(client):
    # A station registers a seller and pays them, with a loan deduction
    admin = _login(client, ADMIN_CONTACT, ADMIN_PASSWORD)
    tag = uuid.uuid4().hex[:6]
    mid = client.post("/api/v1/users/managers", json={
        "name": "M", "contact": f"rec.{tag}@x.com", "password": "Password123!", "business_name": "Kono Produce"}).json()["id"]
    client.post(f"/api/v1/users/{mid}/approve", headers=admin)
    mgr = _login(client, f"rec.{tag}@x.com")
    phone = _phone()
    seller_id = client.post("/api/v1/sellers/", headers=mgr, json={
        "name": "Sia Farmer", "gender": "female", "address": "A", "contact": phone.replace("07", "+232 7", 1),
        "chiefdom": "Gbense", "district": "Kono"}).json()["id"]
    client.post("/api/v1/loans/", headers=mgr, json={"seller_id": seller_id, "date": "2026-11-01", "loan_taken": 100})
    txn = client.post("/api/v1/cola/", headers=mgr, json={
        "seller_id": seller_id, "date": "2026-11-02", "weight_kg": 10, "price_per_kg": 30}).json()
    client.post(f"/api/v1/cola/{txn['id']}/approve", headers=mgr)
    assert client.post(f"/api/v1/cola/{txn['id']}/issue-receipt?loan_deduction=40", headers=mgr).status_code == 200

    # The farmer signs up with the same number
    farmer, _, _ = _signup(client, phone=phone, name="Sia Farmer")
    assert client.get("/api/v1/farmer/records", headers=farmer).status_code == 403   # not verified yet

    SENT_SMS_BUFFER.clear()
    assert client.post("/api/v1/market/me/verify-phone/send", headers=farmer).status_code == 200
    code = SENT_SMS_BUFFER[-1]["message"].split("code is ")[1][:6]
    assert client.post("/api/v1/market/me/verify-phone/confirm", headers=farmer,
                       json={"code": "000000" if code != "000000" else "111111"}).status_code == 400
    assert client.post("/api/v1/market/me/verify-phone/confirm", headers=farmer, json={"code": code}).status_code == 200

    records = client.get("/api/v1/farmer/records", headers=farmer).json()
    assert records["linked_stations"] == ["Kono Produce"]
    assert len(records["receipts"]) == 1 and records["receipts"][0]["net_amount_paid"] == 260.0
    assert records["total_owed"] == 60.0
    # Traders have no station records
    trader, _, _ = _signup(client, "trader")
    assert client.get("/api/v1/farmer/records", headers=trader).status_code == 403


def test_feed_like_save_comment(client):
    farmer, _, _ = _signup(client)
    trader, _, _ = _signup(client, "trader")
    other, _, _ = _signup(client)
    lid = _listing(client, farmer, title=f"Feed post {uuid.uuid4().hex[:5]}")["id"]

    # Like is idempotent and counted once per person
    assert client.put(f"/api/v1/market/listings/{lid}/like", headers=trader).json() == {"active": True, "count": 1}
    assert client.put(f"/api/v1/market/listings/{lid}/like", headers=trader).json()["count"] == 1
    assert client.put(f"/api/v1/market/listings/{lid}/like", headers=other).json()["count"] == 2
    assert client.delete(f"/api/v1/market/listings/{lid}/like", headers=other).json() == {"active": False, "count": 1}

    # Save is private to the person who saved it
    client.put(f"/api/v1/market/listings/{lid}/save", headers=trader)
    saved = client.get("/api/v1/market/listings", headers=trader, params={"saved": True}).json()
    assert [l["id"] for l in saved] == [lid]
    assert client.get("/api/v1/market/listings", headers=other, params={"saved": True}).json() == []

    # Comments
    c1 = client.post(f"/api/v1/market/listings/{lid}/comments", headers=trader, json={"body": "Is it still available?"})
    assert c1.status_code == 201 and c1.json()["can_delete"] is True
    c2 = client.post(f"/api/v1/market/listings/{lid}/comments", headers=other, json={"body": "Spam spam"}).json()
    assert client.post(f"/api/v1/market/listings/{lid}/comments", headers=other, json={"body": "   "}).status_code == 400
    comments = client.get(f"/api/v1/market/listings/{lid}/comments", headers=farmer).json()
    assert [c["body"] for c in comments] == ["Is it still available?", "Spam spam"]
    assert all(c["can_delete"] for c in comments)           # listing owner can remove any comment
    assert client.delete(f"/api/v1/market/comments/{c1.json()['id']}", headers=other).status_code == 403
    assert client.delete(f"/api/v1/market/comments/{c2['id']}", headers=farmer).status_code == 200

    # Counts and the viewer's own state come back on the feed
    post = client.get(f"/api/v1/market/listings/{lid}", headers=trader).json()
    assert post["like_count"] == 1 and post["comment_count"] == 1
    assert post["liked_by_me"] is True and post["saved_by_me"] is True
    mine = client.get(f"/api/v1/market/listings/{lid}", headers=other).json()
    assert mine["liked_by_me"] is False and mine["saved_by_me"] is False


def test_station_secretary_has_full_market_access(client):
    admin = _login(client, ADMIN_CONTACT, ADMIN_PASSWORD)
    tag = uuid.uuid4().hex[:6]
    mid = client.post("/api/v1/users/managers", json={
        "name": "M", "contact": f"sm.{tag}@x.com", "password": "Password123!", "business_name": "Bo Produce"}).json()["id"]
    client.post(f"/api/v1/users/{mid}/approve", headers=admin)
    mgr = _login(client, f"sm.{tag}@x.com")
    r = client.post("/api/v1/users/secretaries", headers=mgr, json={
        "name": "Sec", "contact": f"ss.{tag}@x.com", "password": "Password123!", "station_name": "Bo Town Station"})
    assert r.status_code == 201, r.text
    sec = _login(client, f"ss.{tag}@x.com")

    # Browse, post, upload, offer, like, comment, save: everything a market member can do
    assert client.get("/api/v1/market/listings", headers=sec).status_code == 200
    post = _listing(client, sec, kind="wanted", category="cocoa", title="Station buying dry cocoa today")
    assert post["owner"]["business_name"] == "Bo Produce"   # posts under the company name
    assert client.post(f"/api/v1/market/listings/{post['id']}/media", headers=sec,
                       files={"file": ("a.jpg", JPEG, "image/jpeg")}).status_code == 201

    farmer, _, _ = _signup(client)
    farmer_post = _listing(client, farmer)
    assert client.post(f"/api/v1/market/listings/{farmer_post['id']}/offers", headers=sec,
                       json={"quantity": 2, "price": 400}).status_code == 201
    assert client.put(f"/api/v1/market/listings/{farmer_post['id']}/like", headers=sec).json()["active"] is True
    assert client.post(f"/api/v1/market/listings/{farmer_post['id']}/comments", headers=sec,
                       json={"body": "We can collect at the station."}).status_code == 201
    assert client.put(f"/api/v1/market/listings/{farmer_post['id']}/save", headers=sec).status_code == 200
    assert client.get("/api/v1/market/offers", headers=sec, params={"box": "sent"}).json()[0]["listing_id"] == farmer_post["id"]
    assert client.get("/api/v1/market/my-listings", headers=sec).json()[0]["id"] == post["id"]


def test_signup_duplicate_phone_messages(client):
    _, phone, _ = _signup(client, "farmer")
    r = client.post("/api/v1/market/signup", json={
        "account_type": "trader", "name": "Again", "phone": phone, "password": "Password123!",
        "district": "Bo", "terms_accepted": True})
    assert r.status_code == 409 and "farmer account" in r.json()["detail"]

    # A station manager's phone number blocks it too, with a clear reason
    admin = _login(client, ADMIN_CONTACT, ADMIN_PASSWORD)
    tag = uuid.uuid4().hex[:6]
    staff_phone = _phone()
    client.post("/api/v1/users/managers", json={
        "name": "M", "email": f"dup.{tag}@x.com", "phone_number": staff_phone, "password": "Password123!",
        "business_name": "Dup Produce"})
    r = client.post("/api/v1/market/signup", json={
        "account_type": "farmer", "name": "X Y", "phone": staff_phone, "password": "Password123!",
        "district": "Bo", "terms_accepted": True})
    assert r.status_code == 409 and "buying-station staff" in r.json()["detail"]

    # Digits inside an email address never count as a phone number
    digits = _phone()
    client.post("/api/v1/users/managers", json={
        "name": "M", "email": f"m{digits[1:]}@x.com", "password": "Password123!", "business_name": "Mail Produce"})
    _signup(client, "farmer", phone=digits)


def test_comment_replies_and_likes(client):
    farmer, _, _ = _signup(client)
    trader, _, _ = _signup(client, "trader")
    other, _, _ = _signup(client)
    lid = _listing(client, farmer)["id"]

    top = client.post(f"/api/v1/market/listings/{lid}/comments", headers=trader, json={"body": "Price for 20 bags?"}).json()
    reply = client.post(f"/api/v1/market/listings/{lid}/comments", headers=farmer,
                        json={"body": "Nle 420 a bag for 20.", "parent_id": top["id"]})
    assert reply.status_code == 201 and reply.json()["parent_id"] == top["id"]
    # Replying to a reply stays in the same thread
    nested = client.post(f"/api/v1/market/listings/{lid}/comments", headers=other,
                         json={"body": "I will take 5", "parent_id": reply.json()["id"]}).json()
    assert nested["parent_id"] == top["id"]

    # Comment likes: once per person, toggles off
    assert client.put(f"/api/v1/market/comments/{top['id']}/like", headers=farmer).json() == {"active": True, "count": 1}
    assert client.put(f"/api/v1/market/comments/{top['id']}/like", headers=farmer).json()["count"] == 1
    assert client.put(f"/api/v1/market/comments/{top['id']}/like", headers=other).json()["count"] == 2
    assert client.delete(f"/api/v1/market/comments/{top['id']}/like", headers=other).json() == {"active": False, "count": 1}

    listed = {c["id"]: c for c in client.get(f"/api/v1/market/listings/{lid}/comments", headers=farmer).json()}
    assert listed[top["id"]]["like_count"] == 1 and listed[top["id"]]["liked_by_me"] is True
    assert listed[reply.json()["id"]]["parent_id"] == top["id"]
    assert client.get(f"/api/v1/market/listings/{lid}", headers=farmer).json()["comment_count"] == 3

    # Deleting the top comment removes its whole thread
    r = client.delete(f"/api/v1/market/comments/{top['id']}", headers=trader)
    assert r.status_code == 200 and r.json()["deleted"] == 3
    assert client.get(f"/api/v1/market/listings/{lid}/comments", headers=farmer).json() == []


def test_fulfilled_posts_stay_in_feed(client):
    farmer, _, _ = _signup(client)
    trader, _, _ = _signup(client, "trader")
    post = _listing(client, trader, kind="wanted", title=f"Need maize {uuid.uuid4().hex[:5]}", category="grains")
    client.post(f"/api/v1/market/listings/{post['id']}/status", headers=trader, json={"status": "sold"})

    feed = {l["id"]: l for l in client.get("/api/v1/market/listings", headers=farmer).json()}
    assert feed[post["id"]]["status"] == "sold"            # still visible, marked fulfilled

    # Social actions still work; new offers do not
    assert client.put(f"/api/v1/market/listings/{post['id']}/like", headers=farmer).status_code == 200
    c = client.post(f"/api/v1/market/listings/{post['id']}/comments", headers=farmer, json={"body": "Well done!"}).json()
    assert client.post(f"/api/v1/market/listings/{post['id']}/comments", headers=trader,
                       json={"body": "Thanks", "parent_id": c["id"]}).status_code == 201
    assert client.put(f"/api/v1/market/listings/{post['id']}/save", headers=farmer).status_code == 200
    assert client.post(f"/api/v1/market/listings/{post['id']}/offers", headers=farmer, json={}).status_code == 400

    # Closed posts leave the feed
    client.post(f"/api/v1/market/listings/{post['id']}/status", headers=trader, json={"status": "closed"})
    assert post["id"] not in [l["id"] for l in client.get("/api/v1/market/listings", headers=farmer).json()]


def test_activity_notification_counts(client):
    farmer, _, _ = _signup(client)
    trader, _, _ = _signup(client, "trader")
    other, _, _ = _signup(client)
    lid = _listing(client, farmer)["id"]
    count = lambda h: client.get("/api/v1/market/notifications", headers=h).json()

    assert count(farmer)["total"] == 0
    o1 = client.post(f"/api/v1/market/listings/{lid}/offers", headers=trader, json={"quantity": 1}).json()
    client.post(f"/api/v1/market/listings/{lid}/offers", headers=other, json={"quantity": 2})
    assert count(farmer) == {"offers_received": 2, "offer_updates": 0, "total": 2}

    # Declining one: the owner's count drops, the sender gets an update
    client.post(f"/api/v1/market/offers/{o1['id']}/decline", headers=farmer)
    assert count(farmer)["offers_received"] == 1
    assert count(trader) == {"offers_received": 0, "offer_updates": 1, "total": 1}

    # Opening "Offers sent" clears it
    client.post("/api/v1/market/notifications/seen-updates", headers=trader)
    assert count(trader)["total"] == 0


def test_profile_photo_for_any_role(client):
    from tests.conftest import ADMIN_CONTACT as AC, ADMIN_PASSWORD as AP
    farmer, phone, _ = _signup(client)
    admin = _login(client, AC, AP)
    for headers in (farmer, admin):
        assert client.get("/api/v1/profile/photo", headers=headers).json() == {"avatar_url": None}
        r = client.post("/api/v1/profile/photo", headers=headers, files={"file": ("me.jpg", JPEG, "image/jpeg")})
        assert r.status_code == 200 and r.json()["avatar_url"]
        # Videos and non-images are refused for avatars
        assert client.post("/api/v1/profile/photo", headers=headers,
                           files={"file": ("v.mp4", MP4, "video/mp4")}).status_code == 400

    # The photo shows on the member's posts and comes back at login
    post = _listing(client, farmer)
    assert post["owner"]["avatar_url"]
    login = client.post("/api/v1/auth/login", json={"contact": phone, "password": "Password123!"}).json()
    assert login["avatar_url"]

    assert client.delete("/api/v1/profile/photo", headers=farmer).json() == {"avatar_url": None}
    assert client.get("/api/v1/profile/photo").status_code == 401
