"""Seller location fields, bulk import from CSV/Excel, and traceability exports."""
import io
import uuid
import openpyxl
from tests.conftest import ADMIN_CONTACT, ADMIN_PASSWORD


def _login(client, contact, password):
    resp = client.post("/api/v1/auth/login", json={"contact": contact, "password": password})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def _manager(client):
    admin = _login(client, ADMIN_CONTACT, ADMIN_PASSWORD)
    contact = f"mgr.{uuid.uuid4().hex[:6]}@example.com"
    resp = client.post("/api/v1/users/managers", json={
        "name": "Import Manager", "contact": contact, "password": "Password123!",
        "business_name": "Trace Produce", "station_name": "Trace HQ",
    })
    client.post(f"/api/v1/users/{resp.json()['id']}/approve", headers=admin)
    return _login(client, contact, "Password123!")


def _xlsx(rows):
    wb = openpyxl.Workbook()
    for r in rows:
        wb.active.append(r)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_register_seller_with_location(client):
    mgr = _manager(client)
    resp = client.post("/api/v1/sellers/", headers=mgr, json={
        "name": "Mariama Bangura", "gender": "female", "address": "Blama", "contact": "+23277111222",
        "section": "Blama", "chiefdom": "Small Bo", "district": "kenema district",
    })
    assert resp.status_code == 201, resp.text
    s = resp.json()
    assert (s["section"], s["chiefdom"], s["district"]) == ("Blama", "Small Bo", "Kenema")

    bad = client.post("/api/v1/sellers/", headers=mgr, json={
        "name": "X", "gender": "male", "address": "A", "district": "Atlantis",
    })
    assert bad.status_code == 400

    edited = client.put(f"/api/v1/sellers/{s['id']}", headers=mgr, json={"chiefdom": "Nongowa"})
    assert edited.json()["chiefdom"] == "Nongowa"

    assert "Kenema" in client.get("/api/v1/sellers/districts", headers=mgr).json()


def test_bulk_upload_csv_preview_then_import(client):
    mgr = _manager(client)
    csv_text = (
        "Full Name,Gender,Phone Number,Address / Village,Section,Chiefdom,District\n"
        "Joseph Koroma,Male,+23276123456,Hangha Town,Hangha,Nongowa,Kenema\n"
        "Fatu Sesay,F,076999888,,Tikonko,Tikonko,bo\n"
        ",Male,0761,,,Nongowa,Kenema\n"                       # missing name
        "Ali Kamara,Male,077000111,,,Kakua,Narnia\n"          # unknown district
        "Joseph Koroma,Male,076123456,Hangha Town,Hangha,Nongowa,Kenema\n"  # same person, other prefix
    )
    files = {"file": ("sellers.csv", csv_text.encode("utf-8"), "text/csv")}

    preview = client.post("/api/v1/sellers/bulk-upload?dry_run=true", headers=mgr, files=files)
    assert preview.status_code == 200, preview.text
    p = preview.json()
    assert p["dry_run"] is True and p["created"] == 0
    assert p["total_rows"] == 5 and p["valid_rows"] == 2 and p["skipped_duplicates"] == 1
    assert {e["row"] for e in p["errors"]} == {4, 5}
    assert any("District" in e["reason"] for e in p["errors"])
    names_before = {s["name"] for s in client.get("/api/v1/sellers/", headers=mgr).json()}
    assert "Fatu Sesay" not in names_before

    done = client.post("/api/v1/sellers/bulk-upload?dry_run=false", headers=mgr, files=files).json()
    assert done["created"] == 2
    sellers = {s["name"]: s for s in client.get("/api/v1/sellers/", headers=mgr).json()}
    assert sellers["Fatu Sesay"]["district"] == "Bo"
    assert sellers["Fatu Sesay"]["gender"] == "female"
    assert sellers["Fatu Sesay"]["address"] == "Tikonko, Tikonko, Bo"   # filled from location
    assert sellers["Joseph Koroma"]["seller_id"].startswith("SL-")

    # Re-uploading the same file creates nobody new
    again = client.post("/api/v1/sellers/bulk-upload?dry_run=false", headers=mgr, files=files).json()
    assert again["created"] == 0 and again["skipped_duplicates"] == 3


def test_bulk_upload_excel_and_template(client):
    mgr = _manager(client)
    template = client.get("/api/v1/sellers/bulk-template?format=xlsx", headers=mgr)
    assert template.status_code == 200 and template.content.startswith(b"PK")
    wb = openpyxl.load_workbook(io.BytesIO(template.content))
    assert [c.value for c in wb["Sellers"][1]][:7] == [
        "Full Name", "Gender", "Phone Number", "Address / Village", "Section", "Chiefdom", "District"]

    content = _xlsx([
        ["Seller Name", "Sex", "Phone", "Village", "Section", "Chiefdom", "District"],
        ["Hawa Conteh", "Female", 23278555444, "Daru", "Daru", "Jawie", "Kailahun"],
    ])
    files = {"file": ("farmers.xlsx", content,
                      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    res = client.post("/api/v1/sellers/bulk-upload?dry_run=false", headers=mgr, files=files).json()
    assert res["created"] == 1, res
    hawa = [s for s in client.get("/api/v1/sellers/", headers=mgr).json() if s["name"] == "Hawa Conteh"][0]
    assert hawa["contact"] == "23278555444"   # numeric Excel cell, no ".0"

    bad = client.post("/api/v1/sellers/bulk-upload", headers=mgr,
                      files={"file": ("x.xlsx", _xlsx([["Name", "Phone"]]), "application/octet-stream")})
    assert bad.status_code == 400 and "Chiefdom" in bad.json()["detail"]

    wrong_type = client.post("/api/v1/sellers/bulk-upload", headers=mgr,
                             files={"file": ("x.pdf", b"%PDF", "application/pdf")})
    assert wrong_type.status_code == 400


def test_excel_report_has_traceability_columns(client):
    mgr = _manager(client)
    seller = client.post("/api/v1/sellers/", headers=mgr, json={
        "name": "Sahr Lebbie", "gender": "male", "address": "Koidu", "contact": "+23279000333",
        "section": "Gbense", "chiefdom": "Gbense", "district": "Kono",
    }).json()
    txn = client.post("/api/v1/cocoa/", headers=mgr, json={
        "seller_id": seller["id"], "date": "2026-11-02", "weight_kg": 70, "bags": 1,
        "water_percent": 9, "price_per_kg": 50,
    }).json()
    client.post(f"/api/v1/cocoa/{txn['id']}/approve", headers=mgr)
    receipt = client.post(f"/api/v1/cocoa/{txn['id']}/issue-receipt", headers=mgr).json()
    assert receipt["seller_chiefdom"] == "Gbense" and receipt["seller_district"] == "Kono"

    # JSON report rows carry seller identity too
    row = client.get("/api/v1/reports/produce", headers=mgr).json()["transactions"][0]
    assert row["seller_name"] == "Sahr Lebbie" and row["seller_district"] == "Kono"

    xlsx = client.get("/api/v1/reports/produce/export?format=excel", headers=mgr)
    assert xlsx.status_code == 200
    wb = openpyxl.load_workbook(io.BytesIO(xlsx.content))
    ws = wb["Produce Purchases"]
    header_row = next(r for r in ws.iter_rows(values_only=True) if r and r[0] == "No.")
    for label in ("Seller Full Name", "Address / Village", "Section", "Chiefdom", "District",
                  "Receipt No.", "Net Cash Paid (Nle)"):
        assert label in header_row
    data = [r for r in ws.iter_rows(values_only=True) if r and r[0] == 1][0]
    by_label = dict(zip(header_row, data))
    assert by_label["Seller Full Name"] == "Sahr Lebbie"
    assert by_label["Chiefdom"] == "Gbense" and by_label["District"] == "Kono"
    assert by_label["Receipt No."] == receipt["receipt_number"]
    assert "Summary" in wb.sheetnames

    pdf = client.get("/api/v1/reports/produce/export?format=pdf", headers=mgr)
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")
