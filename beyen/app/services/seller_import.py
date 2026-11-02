"""
Bulk seller import from CSV or Excel (.xlsx).

Columns are matched by header name, case-insensitively, with common aliases
("Full Name", "Phone", ...). Required: Full Name, Chiefdom, District.
Every row is validated first; nothing is saved when dry_run is set, and in a
real import only valid, non-duplicate rows are saved (in one transaction).
"""
import csv
import io
from dataclasses import dataclass, field
from app.core.locations import DISTRICTS, normalize_district
from app.models.seller import GenderEnum
from app.schemas.seller import SellerCreate

MAX_ROWS = 5000

# canonical field -> accepted header spellings (lower-case, spaces collapsed)
HEADER_ALIASES = {
    "name": {"full name", "name", "seller name", "seller full name", "farmer name", "fullname"},
    "gender": {"gender", "sex"},
    "contact": {"phone", "phone number", "contact", "contact number", "mobile", "telephone", "tel"},
    "address": {"address", "village", "address / village", "town", "village / town"},
    "section": {"section"},
    "chiefdom": {"chiefdom"},
    "district": {"district"},
}

TEMPLATE_HEADERS = ["Full Name", "Gender", "Phone Number", "Address / Village", "Section", "Chiefdom", "District"]
TEMPLATE_EXAMPLE = ["Joseph Koroma", "Male", "+23276123456", "Hangha Town", "Hangha", "Nongowa", "Kenema"]

_GENDERS = {
    "m": GenderEnum.male, "male": GenderEnum.male,
    "f": GenderEnum.female, "female": GenderEnum.female,
    "o": GenderEnum.other, "other": GenderEnum.other, "": GenderEnum.other,
}


class ImportFileError(ValueError):
    pass


@dataclass
class ParsedRow:
    row_number: int
    seller: SellerCreate | None = None
    name: str | None = None
    errors: list[str] = field(default_factory=list)


def _cell_text(value) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        value = int(value)  # Excel stores phone numbers as numbers: 23276123456.0
    return " ".join(str(value).split())


def _read_rows(filename: str, content: bytes) -> list[list[str]]:
    name = (filename or "").lower()
    if name.endswith(".xlsx") or name.endswith(".xlsm"):
        import openpyxl
        try:
            wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
        except Exception:
            raise ImportFileError("Could not read the Excel file. Save it as .xlsx and try again.")
        ws = wb.worksheets[0]
        rows = [[_cell_text(v) for v in row] for row in ws.iter_rows(values_only=True)]
        wb.close()
        return rows
    if name.endswith(".csv") or name.endswith(".txt"):
        for encoding in ("utf-8-sig", "cp1252", "latin-1"):
            try:
                text = content.decode(encoding)
                break
            except UnicodeDecodeError:
                continue
        try:
            dialect = csv.Sniffer().sniff(text[:2048], delimiters=",;\t")
        except csv.Error:
            dialect = csv.excel
        return [[_cell_text(v) for v in row] for row in csv.reader(io.StringIO(text), dialect)]
    raise ImportFileError("Unsupported file type. Upload a .csv or .xlsx file.")


def _map_headers(header: list[str]) -> dict[str, int]:
    mapping = {}
    for idx, raw in enumerate(header):
        key = " ".join(raw.lower().replace("*", "").split())
        for fld, aliases in HEADER_ALIASES.items():
            if key in aliases and fld not in mapping:
                mapping[fld] = idx
    missing = [f for f in ("name", "chiefdom", "district") if f not in mapping]
    if missing:
        labels = {"name": "Full Name", "chiefdom": "Chiefdom", "district": "District"}
        raise ImportFileError(
            "Missing required column(s): " + ", ".join(labels[m] for m in missing)
            + ". Download the template to see the expected columns."
        )
    return mapping


def parse_seller_file(filename: str, content: bytes) -> list[ParsedRow]:
    rows = _read_rows(filename, content)
    # Skip leading blank lines before the header
    while rows and not any(rows[0]):
        rows.pop(0)
    if not rows:
        raise ImportFileError("The file is empty.")

    mapping = _map_headers(rows[0])
    data_rows = [(i + 2, r) for i, r in enumerate(rows[1:]) if any(c for c in r)]
    if len(data_rows) > MAX_ROWS:
        raise ImportFileError(f"Too many rows ({len(data_rows)}). Import at most {MAX_ROWS} sellers per file.")

    parsed = []
    for row_number, row in data_rows:
        def get(fld):
            idx = mapping.get(fld)
            return row[idx].strip() if idx is not None and idx < len(row) else ""

        p = ParsedRow(row_number=row_number, name=get("name") or None)
        name = get("name")
        if not name:
            p.errors.append("Full Name is required")
        elif len(name) > 120:
            p.errors.append("Full Name is longer than 120 characters")

        gender_raw = get("gender").lower()
        gender = _GENDERS.get(gender_raw)
        if gender is None:
            p.errors.append(f"Gender '{get('gender')}' must be Male, Female or Other")

        contact = get("contact")
        if len(contact) > 30:
            p.errors.append("Phone Number is longer than 30 characters")

        chiefdom = get("chiefdom")
        if not chiefdom:
            p.errors.append("Chiefdom is required")

        district_raw = get("district")
        district = normalize_district(district_raw)
        if not district_raw:
            p.errors.append("District is required")
        elif not district:
            p.errors.append(f"Unknown District '{district_raw}'. Use one of: {', '.join(DISTRICTS)}")

        section = get("section")
        address = get("address")
        for label, value in (("Address", address), ("Section", section), ("Chiefdom", chiefdom)):
            if len(value) > (255 if label == "Address" else 120):
                p.errors.append(f"{label} is too long")

        if not p.errors:
            p.seller = SellerCreate(
                name=name,
                gender=gender,
                contact=contact or None,
                address=address or ", ".join(x for x in (section, chiefdom, district) if x),
                section=section or None,
                chiefdom=chiefdom,
                district=district,
            )
        parsed.append(p)
    return parsed


def duplicate_key(name: str | None, contact: str | None, chiefdom: str | None, district: str | None) -> tuple:
    """Same person = same name + phone, or (no phone) same name in the same chiefdom and district."""
    n = " ".join((name or "").lower().split())
    c = "".join(ch for ch in (contact or "") if ch.isdigit())
    if c:
        return ("phone", n, c[-8:])  # last 8 digits ignore +232 / 0 prefix differences
    return ("place", n, (chiefdom or "").strip().lower(), (district or "").strip().lower())


def build_template_xlsx() -> bytes:
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment
    from openpyxl.worksheet.datavalidation import DataValidation

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Sellers"
    ws.append(TEMPLATE_HEADERS)
    ws.append(TEMPLATE_EXAMPLE)
    fill = PatternFill(start_color="065F46", end_color="065F46", fill_type="solid")
    for cell in ws[1]:
        cell.font = Font(color="FFFFFF", bold=True)
        cell.fill = fill
        cell.alignment = Alignment(horizontal="center", vertical="center")
    widths = [26, 10, 18, 26, 18, 20, 20]
    for idx, w in enumerate(widths, 1):
        ws.column_dimensions[openpyxl.utils.get_column_letter(idx)].width = w
    ws.freeze_panes = "A2"
    # Phone numbers as text so leading zeros / + survive
    for row in range(2, MAX_ROWS + 2):
        ws.cell(row=row, column=3).number_format = "@"

    lists = wb.create_sheet("Lists")
    for i, d in enumerate(DISTRICTS, 1):
        lists.cell(row=i, column=1, value=d)
    lists.sheet_state = "hidden"

    gender_dv = DataValidation(type="list", formula1='"Male,Female,Other"', allow_blank=True)
    district_dv = DataValidation(type="list", formula1=f"=Lists!$A$1:$A${len(DISTRICTS)}", allow_blank=False)
    ws.add_data_validation(gender_dv)
    ws.add_data_validation(district_dv)
    gender_dv.add(f"B2:B{MAX_ROWS + 1}")
    district_dv.add(f"G2:G{MAX_ROWS + 1}")

    notes = wb.create_sheet("Instructions")
    for line in [
        "How to fill this template",
        "",
        "Full Name, Chiefdom and District are required.",
        "Gender: Male, Female or Other (blank = Other).",
        "District: pick from the list (the 16 districts of Sierra Leone).",
        "Phone Number: type it as text, e.g. +23276123456 or 076123456.",
        "Address / Village: optional; if blank it is filled from Section, Chiefdom, District.",
        "Delete the example row before uploading. Up to 5,000 sellers per file.",
        "Sellers already registered (same name and phone) are skipped automatically.",
    ]:
        notes.append([line])
    notes["A1"].font = Font(bold=True, size=13)
    notes.column_dimensions["A"].width = 90

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def build_template_csv() -> bytes:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(TEMPLATE_HEADERS)
    writer.writerow(TEMPLATE_EXAMPLE)
    return ("﻿" + buf.getvalue()).encode("utf-8")  # BOM so Excel opens it as UTF-8
