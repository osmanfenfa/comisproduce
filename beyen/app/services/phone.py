"""Sierra Leone phone numbers: one canonical form so 076…, 23276… and +232 76… match."""
import re

COUNTRY_CODE = "232"
_NATIONAL_LEN = 8  # e.g. 76 123456


class InvalidPhone(ValueError):
    pass


def digits(value: str | None) -> str:
    return re.sub(r"\D", "", value or "")


def normalize_phone(value: str | None) -> str:
    """'076 123 456' / '23276123456' / '+232-76-123456' -> '+23276123456'."""
    d = digits(value)
    if d.startswith("00"):
        d = d[2:]
    if d.startswith(COUNTRY_CODE) and len(d) == len(COUNTRY_CODE) + _NATIONAL_LEN:
        d = d[len(COUNTRY_CODE):]
    elif d.startswith("0") and len(d) == _NATIONAL_LEN + 1:
        d = d[1:]
    if len(d) != _NATIONAL_LEN:
        raise InvalidPhone("Enter a valid Sierra Leone phone number, e.g. 076 123 456.")
    return f"+{COUNTRY_CODE}{d}"


def phone_key(value: str | None) -> str | None:
    """Last 8 digits: compares numbers written with or without the country code."""
    d = digits(value)
    return d[-_NATIONAL_LEN:] if len(d) >= _NATIONAL_LEN else None


def looks_like_phone(value: str | None) -> bool:
    return bool(value) and "@" not in value and len(digits(value)) >= _NATIONAL_LEN
