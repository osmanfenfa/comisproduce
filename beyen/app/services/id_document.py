"""
Identity documents for market verification (National ID card or passport).

- Photos are stored privately (PRIVATE_MEDIA_ROOT), never under the public /media
  path, and are only served to the owner and to admins through authenticated endpoints.
- The document number is read from the photo with OCR:
    passport: the machine-readable zone (MRZ), checked with its ICAO check digit,
              falling back to the "Passport No" label;
    NIN:      the text next to the "NIN" / "National Identification Number" label,
              falling back to the ID card's MRZ.
  The user confirms or corrects the number and an admin approves it: OCR finding a
  number does not prove the document is genuine.
"""
import os
import re
import uuid
from dataclasses import dataclass, field
from fastapi import UploadFile
from app.core.config import settings

MAX_ID_BYTES = 8 * 1024 * 1024
_CHUNK = 1024 * 1024

DOC_TYPES = {"nin": "National ID card", "passport": "Passport"}


class IdDocumentRejected(ValueError):
    pass


@dataclass
class Extraction:
    number: str | None = None
    method: str | None = None            # "mrz" | "label" | None
    lines: list[str] = field(default_factory=list)
    ocr_available: bool = True


# ---------------------------------------------------------------------------
# storage (private)
# ---------------------------------------------------------------------------

def _sniff_image(head: bytes) -> str | None:
    if head.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "webp"
    return None


async def save_private(upload: UploadFile, user_id: uuid.UUID) -> str:
    """Save the ID photo outside the public media folder; returns its relative path."""
    head = await upload.read(16)
    ext = _sniff_image(head)
    if not ext:
        raise IdDocumentRejected("Upload a clear photo of the document (JPG, PNG or WEBP).")
    rel = f"id_documents/{user_id}/{uuid.uuid4().hex}.{ext}"
    full = private_path(rel)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    size = len(head)
    try:
        with open(full, "wb") as out:
            out.write(head)
            while chunk := await upload.read(_CHUNK):
                size += len(chunk)
                if size > MAX_ID_BYTES:
                    raise IdDocumentRejected("Photo is larger than 8 MB.")
                out.write(chunk)
    except BaseException:
        if os.path.exists(full):
            os.remove(full)
        raise
    return rel


def private_path(rel: str) -> str:
    return os.path.join(settings.PRIVATE_MEDIA_ROOT, *rel.split("/"))


def delete_private(rel: str | None) -> None:
    if rel and os.path.isfile(private_path(rel)):
        os.remove(private_path(rel))


# ---------------------------------------------------------------------------
# OCR + number extraction
# ---------------------------------------------------------------------------

def _ocr_lines_local(path: str) -> list[str] | None:
    """Local OCR (rapidocr) in a child process: a crash or hang there can't affect the API."""
    import json
    import subprocess
    import sys
    try:
        out = subprocess.run(
            [sys.executable, "-m", "app.services.ocr_worker", path],
            capture_output=True, text=True, timeout=60,
            cwd=os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")),
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    if out.returncode != 0:
        return None          # engine missing or crashed: fall back to typing the number
    try:
        return json.loads(out.stdout.strip().splitlines()[-1])
    except (ValueError, IndexError):
        return None


def _ocr_lines_ocrspace(path: str) -> list[str] | None:
    """OCR.space cloud API. Sends the image to a third party, so it is opt-in (OCR_SPACE_API_KEY)."""
    import json
    import urllib.request
    boundary = uuid.uuid4().hex
    with open(path, "rb") as fh:
        data = fh.read()
    crlf = b"\r\n"
    body = b""
    for name, value in (("apikey", settings.OCR_SPACE_API_KEY), ("OCREngine", "2"), ("scale", "true")):
        body += f"--{boundary}".encode() + crlf
        body += f'Content-Disposition: form-data; name="{name}"'.encode() + crlf + crlf
        body += str(value).encode() + crlf
    body += f"--{boundary}".encode() + crlf
    body += f'Content-Disposition: form-data; name="file"; filename="{os.path.basename(path)}"'.encode() + crlf
    body += b"Content-Type: application/octet-stream" + crlf + crlf + data + crlf
    body += f"--{boundary}--".encode() + crlf
    req = urllib.request.Request(
        "https://api.ocr.space/parse/image", data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except Exception:
        return None
    results = payload.get("ParsedResults") or []
    text = "\n".join(r.get("ParsedText", "") for r in results)
    return [line.strip() for line in text.splitlines() if line.strip()]


def _ocr_lines(path: str) -> list[str] | None:
    """Text lines from the image, top to bottom, or None if OCR isn't available."""
    provider = settings.OCR_PROVIDER
    if provider == "ocrspace" and settings.OCR_SPACE_API_KEY:
        return _ocr_lines_ocrspace(path)
    if provider == "local":
        return _ocr_lines_local(path)
    return None


def _clean(token: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", token.upper())


_WEIGHTS = (7, 3, 1)


def _mrz_value(ch: str) -> int:
    if ch.isdigit():
        return int(ch)
    if ch == "<":
        return 0
    return ord(ch) - 55     # A=10 ... Z=35


def mrz_check_digit(data: str) -> int:
    return sum(_mrz_value(c) * _WEIGHTS[i % 3] for i, c in enumerate(data)) % 10


def _mrz_candidates(lines: list[str]) -> list[str]:
    out = []
    for line in lines:
        s = line.upper().replace(" ", "").replace("«", "<")
        if s.count("<") >= 2 and len(s) >= 28 and re.fullmatch(r"[A-Z0-9<]+", s):
            out.append(s)
    return out


def _passport_from_mrz(mrz: list[str]) -> str | None:
    # TD3 line 2: document number (9) + check digit
    for s in mrz:
        m = re.match(r"([A-Z0-9<]{9})(\d)[A-Z<]{3}\d{6}", s)
        if m and mrz_check_digit(m.group(1)) == int(m.group(2)):
            number = m.group(1).replace("<", "")
            if len(number) >= 6:
                return number
    return None


def _id_card_mrz(mrz: list[str]) -> tuple[str | None, str | None]:
    """TD1 line 1: I?SLE + document number (9) + check digit + optional data (personal number)."""
    for s in mrz:
        m = re.match(r"I[A-Z<][A-Z<]{3}([A-Z0-9<]{9})(\d)([A-Z0-9<]{0,15})", s)
        if m and mrz_check_digit(m.group(1)) == int(m.group(2)):
            optional = m.group(3).replace("<", "")
            return (optional or None), m.group(1).replace("<", "")
    return None, None


_NIN_LABEL = re.compile(r"\b(N\.?I\.?N|NATIONAL\s+IDENTIFICATION\s+(NUMBER|NO)|PERSONAL\s+(ID|NUMBER))\b", re.I)
_PASSPORT_LABEL = re.compile(r"(PASSPORT\s*(NO|NUMBER|N°)|DOCUMENT\s*(NO|NUMBER))", re.I)


def _after_label(lines: list[str], label: re.Pattern, token: re.Pattern) -> str | None:
    for i, line in enumerate(lines):
        m = label.search(line)
        if not m:
            continue
        # same line, after the label
        for t in re.split(r"[\s:/]+", line[m.end():]):
            if token.fullmatch(_clean(t)):
                return _clean(t)
        # or the next line or two
        for nxt in lines[i + 1:i + 3]:
            for t in re.split(r"[\s:/]+", nxt):
                if token.fullmatch(_clean(t)):
                    return _clean(t)
    return None


_NIN_TOKEN = re.compile(r"(?=.*\d)[A-Z0-9]{6,14}")
_PASSPORT_TOKEN = re.compile(r"[A-Z]{1,2}\d{6,8}")


def extract_number(doc_type: str, rel_path: str) -> Extraction:
    lines = _ocr_lines(private_path(rel_path))
    if lines is None:
        return Extraction(ocr_available=False)
    mrz = _mrz_candidates(lines)

    if doc_type == "passport":
        number = _passport_from_mrz(mrz)
        if number:
            return Extraction(number, "mrz", lines)
        number = _after_label(lines, _PASSPORT_LABEL, _PASSPORT_TOKEN)
        if not number:  # any passport-shaped token on the page
            for line in lines:
                for t in line.split():
                    if _PASSPORT_TOKEN.fullmatch(_clean(t)):
                        number = _clean(t)
                        break
                if number:
                    break
        return Extraction(number, "label" if number else None, lines)

    number = _after_label(lines, _NIN_LABEL, _NIN_TOKEN)
    if number:
        return Extraction(number, "label", lines)
    personal, document = _id_card_mrz(mrz)
    if personal or document:
        return Extraction(personal or document, "mrz", lines)
    return Extraction(None, None, lines)


def normalize_number(value: str) -> str:
    return _clean(value or "")
