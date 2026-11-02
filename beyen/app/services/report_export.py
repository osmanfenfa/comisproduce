"""
Report export utilities.
export_produce_excel — returns bytes (XLSX): purchases with full seller traceability,
                       plus summaries by district/chiefdom and by commodity
export_produce_pdf   — returns bytes (PDF): condensed, printable version
"""
import io
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Callable, Dict, List

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

GREEN = "065F46"
LIGHT_GREEN = "ECFDF5"
GREY = "F1F5F9"
KG = '#,##0.00'
MONEY = '#,##0.00'
PCT = '0.0"%"'
INT = '#,##0'
DATE = 'dd-mmm-yyyy'
DATETIME = 'dd-mmm-yyyy hh:mm'

_thin = Side(style="thin", color="CBD5E1")
BORDER = Border(left=_thin, right=_thin, top=_thin, bottom=_thin)


@dataclass
class Col:
    group: str
    label: str
    width: float
    value: Callable[[Dict[str, Any]], Any]
    fmt: str | None = None
    total: bool = False


def _d(value) -> date | None:
    if isinstance(value, (date, datetime)) or value is None:
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def _blank(value):
    return value if value not in (None, "") else None


PRODUCE_COLUMNS: List[Col] = [
    Col("TRANSACTION", "No.", 6, lambda r: r["_n"], INT),
    Col("TRANSACTION", "Purchase Date", 13, lambda r: _d(r["date"]), DATE),
    Col("TRANSACTION", "Receipt No.", 18, lambda r: _blank(r.get("receipt_number"))),
    Col("TRANSACTION", "Commodity", 11, lambda r: r["commodity"].title()),
    Col("TRANSACTION", "Status", 11, lambda r: r["status"].title()),
    Col("TRANSACTION", "Buying Station", 20, lambda r: _blank(r.get("station_name"))),
    Col("SELLER", "Seller ID", 11, lambda r: _blank(r.get("seller_code"))),
    Col("SELLER", "Seller Full Name", 26, lambda r: _blank(r.get("seller_name"))),
    Col("SELLER", "Phone Number", 16, lambda r: _blank(r.get("seller_contact"))),
    Col("SELLER", "Address / Village", 26, lambda r: _blank(r.get("seller_address"))),
    Col("SELLER LOCATION", "Section", 16, lambda r: _blank(r.get("seller_section"))),
    Col("SELLER LOCATION", "Chiefdom", 18, lambda r: _blank(r.get("seller_chiefdom"))),
    Col("SELLER LOCATION", "District", 16, lambda r: _blank(r.get("seller_district"))),
    Col("PRODUCE", "Bags", 7, lambda r: r.get("bags"), INT, total=True),
    Col("PRODUCE", "Gross Weight (kg)", 13, lambda r: r.get("weight_kg"), KG, total=True),
    Col("PRODUCE", "Moisture (%)", 11, lambda r: r.get("water_percent") if r["commodity"] == "cocoa" else None, PCT),
    Col("PRODUCE", "Moisture Deduction (kg)", 13,
        lambda r: r.get("moisture_deduction_kg") if r["commodity"] == "cocoa" else None, KG, total=True),
    Col("PRODUCE", "Net Weight (kg)", 13,
        lambda r: r["net_weight_kg"] if r.get("net_weight_kg") is not None else r.get("weight_kg"), KG, total=True),
    Col("PRODUCE", "Price per kg (Nle)", 13, lambda r: r.get("price_per_kg"), MONEY),
    Col("PAYMENT", "Total Value (Nle)", 15, lambda r: r.get("total_price"), MONEY, total=True),
    Col("PAYMENT", "Loan Deduction (Nle)", 14, lambda r: r.get("loan_deduction"), MONEY, total=True),
    Col("PAYMENT", "Net Cash Paid (Nle)", 15, lambda r: r.get("net_amount_paid"), MONEY, total=True),
    Col("AUDIT TRAIL", "Recorded By", 20, lambda r: _blank(r.get("recorded_by_name"))),
    Col("AUDIT TRAIL", "Receipt Issued By", 20, lambda r: _blank(r.get("issued_by_name"))),
    Col("AUDIT TRAIL", "Receipt Issued At", 17, lambda r: r.get("issued_at"), DATETIME),
]


def _title_block(ws, title: str, meta: Dict[str, str], width: int) -> int:
    """Writes the report heading; returns the next free row."""
    last = get_column_letter(width)
    rows = [
        (title, Font(bold=True, size=15, color=GREEN)),
        (meta.get("business", ""), Font(bold=True, size=12)),
        (f"Period: {meta.get('period', '')}    |    Filters: {meta.get('filters', 'None')}", Font(size=10, color="475569")),
        (f"Generated: {datetime.now():%d %b %Y %H:%M}" + (f" by {meta['generated_by']}" if meta.get("generated_by") else ""),
         Font(size=10, color="475569")),
    ]
    for i, (text, font) in enumerate(rows, 1):
        ws.merge_cells(f"A{i}:{last}{i}")
        cell = ws[f"A{i}"]
        cell.value = text
        cell.font = font
        cell.alignment = Alignment(vertical="center")
    ws.row_dimensions[1].height = 22
    return len(rows) + 2


def _header(ws, row: int, labels: List[str], fill: str = GREEN) -> None:
    for c, label in enumerate(labels, 1):
        cell = ws.cell(row=row, column=c, value=label)
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill(start_color=fill, end_color=fill, fill_type="solid")
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = BORDER


def _write_purchases_sheet(ws, rows: List[Dict[str, Any]], meta: Dict[str, str]) -> None:
    cols = PRODUCE_COLUMNS
    group_row = _title_block(ws, "PRODUCE PURCHASE & TRACEABILITY REPORT", meta, len(cols))
    header_row = group_row + 1

    # Group band (TRANSACTION / SELLER / SELLER LOCATION / ...) above the column labels
    group_fills = {"TRANSACTION": "334155", "SELLER": "065F46", "SELLER LOCATION": "047857",
                   "PRODUCE": "92400E", "PAYMENT": "1E3A8A", "AUDIT TRAIL": "475569"}
    start = 1
    for i in range(1, len(cols) + 1):
        if i == len(cols) or cols[i].group != cols[start - 1].group:
            if i > start:
                ws.merge_cells(start_row=group_row, start_column=start, end_row=group_row, end_column=i)
            cell = ws.cell(row=group_row, column=start, value=cols[start - 1].group)
            color = group_fills.get(cols[start - 1].group, GREEN)
            for c in range(start, i + 1):
                g = ws.cell(row=group_row, column=c)
                g.fill = PatternFill(start_color=color, end_color=color, fill_type="solid")
                g.border = BORDER
            cell.font = Font(bold=True, color="FFFFFF", size=9)
            cell.alignment = Alignment(horizontal="center", vertical="center")
            start = i + 1

    _header(ws, header_row, [c.label for c in cols])
    ws.row_dimensions[header_row].height = 32

    first_data = header_row + 1
    alt = PatternFill(start_color=LIGHT_GREEN, end_color=LIGHT_GREEN, fill_type="solid")
    for n, r in enumerate(rows, 1):
        r["_n"] = n
        excel_row = first_data + n - 1
        for c, col in enumerate(cols, 1):
            cell = ws.cell(row=excel_row, column=c, value=col.value(r))
            cell.border = BORDER
            if col.fmt:
                cell.number_format = col.fmt
            if n % 2 == 0:
                cell.fill = alt

    last_data = first_data + len(rows) - 1
    total_row = last_data + 1
    ws.cell(row=total_row, column=1, value="TOTAL").font = Font(bold=True)
    ws.cell(row=total_row, column=2, value=f"{len(rows)} purchase(s)").font = Font(bold=True)
    total_fill = PatternFill(start_color=GREY, end_color=GREY, fill_type="solid")
    for c, col in enumerate(cols, 1):
        cell = ws.cell(row=total_row, column=c)
        cell.fill = total_fill
        cell.border = Border(top=Side(style="medium", color="0F172A"), bottom=Side(style="double", color="0F172A"))
        if col.total and rows:
            letter = get_column_letter(c)
            cell.value = f"=SUBTOTAL(9,{letter}{first_data}:{letter}{last_data})"
            cell.number_format = col.fmt or MONEY
            cell.font = Font(bold=True)

    for c, col in enumerate(cols, 1):
        ws.column_dimensions[get_column_letter(c)].width = col.width
    ws.freeze_panes = ws.cell(row=first_data, column=9)  # keep headers + No..Seller name visible
    if rows:
        ws.auto_filter.ref = f"A{header_row}:{get_column_letter(len(cols))}{last_data}"

    ws.page_setup.orientation = "landscape"
    ws.page_setup.paperSize = ws.PAPERSIZE_A4
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.print_title_rows = f"{group_row}:{header_row}"
    ws.oddFooter.center.text = "Page &P of &N"


def _write_summary_sheet(ws, rows: List[Dict[str, Any]], meta: Dict[str, str]) -> None:
    labels = ["District", "Chiefdom", "Sellers", "Purchases", "Bags", "Net Weight (kg)", "Total Value (Nle)"]
    next_row = _title_block(ws, "SUMMARY BY DISTRICT & CHIEFDOM", meta, len(labels))

    groups: Dict[tuple, Dict[str, Any]] = defaultdict(lambda: {"sellers": set(), "n": 0, "bags": 0,
                                                               "kg": 0.0, "value": Decimal("0")})
    for r in rows:
        key = (r.get("seller_district") or "(Not recorded)", r.get("seller_chiefdom") or "(Not recorded)")
        g = groups[key]
        g["sellers"].add(r["seller_id"])
        g["n"] += 1
        g["bags"] += r.get("bags") or 0
        g["kg"] += r["net_weight_kg"] if r.get("net_weight_kg") is not None else (r.get("weight_kg") or 0)
        g["value"] += Decimal(str(r.get("total_price") or 0))

    _header(ws, next_row, labels)
    row = next_row + 1
    fmts = [None, None, INT, INT, INT, KG, MONEY]
    for (district, chiefdom), g in sorted(groups.items()):
        values = [district, chiefdom, len(g["sellers"]), g["n"], g["bags"], round(g["kg"], 2), g["value"]]
        for c, (v, f) in enumerate(zip(values, fmts), 1):
            cell = ws.cell(row=row, column=c, value=v)
            cell.border = BORDER
            if f:
                cell.number_format = f
        row += 1

    commodity_row = row + 2
    ws.cell(row=commodity_row - 1, column=1, value="By commodity").font = Font(bold=True, size=12, color=GREEN)
    c_labels = ["Commodity", "Purchases", "Bags", "Gross Weight (kg)", "Net Weight (kg)", "Total Value (Nle)"]
    _header(ws, commodity_row, c_labels)
    by_c: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"n": 0, "bags": 0, "gross": 0.0, "net": 0.0,
                                                           "value": Decimal("0")})
    for r in rows:
        g = by_c[r["commodity"].title()]
        g["n"] += 1
        g["bags"] += r.get("bags") or 0
        g["gross"] += r.get("weight_kg") or 0
        g["net"] += r["net_weight_kg"] if r.get("net_weight_kg") is not None else (r.get("weight_kg") or 0)
        g["value"] += Decimal(str(r.get("total_price") or 0))
    row = commodity_row + 1
    for name, g in sorted(by_c.items()):
        values = [name, g["n"], g["bags"], round(g["gross"], 2), round(g["net"], 2), g["value"]]
        for c, (v, f) in enumerate(zip(values, [None, INT, INT, KG, KG, MONEY]), 1):
            cell = ws.cell(row=row, column=c, value=v)
            cell.border = BORDER
            if f:
                cell.number_format = f
        row += 1

    for c, w in enumerate([22, 24, 10, 11, 9, 17, 18], 1):
        ws.column_dimensions[get_column_letter(c)].width = w


def export_produce_excel(rows: List[Dict[str, Any]], meta: Dict[str, str]) -> bytes:
    wb = openpyxl.Workbook()
    purchases = wb.active
    purchases.title = "Produce Purchases"
    _write_purchases_sheet(purchases, rows, meta)
    _write_summary_sheet(wb.create_sheet("Summary"), rows, meta)

    buffer = io.BytesIO()
    wb.save(buffer)
    return buffer.getvalue()


def _fmt_money(v) -> str:
    return f"{v:,.2f}" if v is not None else ""


def export_produce_pdf(rows: List[Dict[str, Any]], meta: Dict[str, str]) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=landscape(A4),
        rightMargin=1 * cm, leftMargin=1 * cm, topMargin=1.2 * cm, bottomMargin=1.2 * cm,
        title="Produce Purchase & Traceability Report",
    )
    styles = getSampleStyleSheet()
    cell = ParagraphStyle("cell", parent=styles["Normal"], fontSize=7.5, leading=9)
    small = ParagraphStyle("small", parent=styles["Normal"], fontSize=9, textColor=colors.HexColor("#475569"))

    elements = [
        Paragraph("<b>PRODUCE PURCHASE &amp; TRACEABILITY REPORT</b>", styles["Title"]),
        Paragraph(f"<b>{meta.get('business', '')}</b>", styles["Heading3"]),
        Paragraph(f"Period: {meta.get('period', '')} &nbsp;|&nbsp; Filters: {meta.get('filters', 'None')} "
                  f"&nbsp;|&nbsp; Generated {datetime.now():%d %b %Y %H:%M}", small),
        Spacer(1, 0.4 * cm),
    ]

    header = ["Date", "Receipt No.", "Commodity", "Seller (ID)", "Phone", "Section / Chiefdom / District",
              "Bags", "Net kg", "Value (Nle)", "Status"]
    table_data = [header]
    total_bags, total_kg, total_value = 0, 0.0, Decimal("0")
    for r in rows:
        net = r["net_weight_kg"] if r.get("net_weight_kg") is not None else r.get("weight_kg") or 0
        location = " / ".join(x for x in (r.get("seller_section"), r.get("seller_chiefdom"), r.get("seller_district")) if x)
        table_data.append([
            _d(r["date"]).strftime("%d-%b-%Y") if _d(r["date"]) else r["date"],
            r.get("receipt_number") or "—",
            r["commodity"].title(),
            Paragraph(f"<b>{r.get('seller_name') or ''}</b><br/>{r.get('seller_code') or ''}", cell),
            r.get("seller_contact") or "",
            Paragraph(location or (r.get("seller_address") or ""), cell),
            r.get("bags") or 0,
            f"{net:,.2f}",
            _fmt_money(r.get("total_price")),
            r["status"].title(),
        ])
        total_bags += r.get("bags") or 0
        total_kg += net
        total_value += Decimal(str(r.get("total_price") or 0))
    table_data.append(["TOTAL", f"{len(rows)} purchase(s)", "", "", "", "", total_bags,
                       f"{total_kg:,.2f}", _fmt_money(total_value), ""])

    widths = [2.1, 3.2, 1.9, 4.6, 2.6, 5.4, 1.2, 2.0, 2.5, 2.0]
    table = Table(table_data, colWidths=[w * cm for w in widths], repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#" + GREEN)),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, colors.HexColor("#" + LIGHT_GREEN)]),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#" + GREY)),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("LINEABOVE", (0, -1), (-1, -1), 1, colors.black),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#CBD5E1")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (6, 1), (8, -1), "RIGHT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
    ]))
    elements.append(table)

    def _footer(canvas, doc_):
        canvas.saveState()
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(colors.HexColor("#64748B"))
        canvas.drawRightString(landscape(A4)[0] - 1 * cm, 0.6 * cm, f"Page {doc_.page}")
        canvas.restoreState()

    doc.build(elements, onFirstPage=_footer, onLaterPages=_footer)
    return buffer.getvalue()
