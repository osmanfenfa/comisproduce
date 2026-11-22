"""
SMS sending for phone verification codes.

Only a "console" provider exists today: it prints the message (development) or
keeps it in SENT_SMS_BUFFER (tests). Plug a real gateway (Africa's Talking,
Orange SMS API, ...) into send_sms() before relying on phone verification in
production; until then verification reports itself as unavailable there.
"""
from typing import Any, Dict, List
from app.core.config import settings

SENT_SMS_BUFFER: List[Dict[str, Any]] = []


class SmsUnavailable(Exception):
    pass


def sms_available() -> bool:
    return settings.SMS_PROVIDER != "console" or settings.APP_ENV in ("development", "testing")


def send_sms(to_phone: str, message: str) -> None:
    if settings.SMS_PROVIDER == "console":
        if settings.APP_ENV == "testing":
            SENT_SMS_BUFFER.append({"to": to_phone, "message": message})
            return
        if settings.APP_ENV == "development":
            print(f"[SMS DEV] to {to_phone}: {message}")
            return
        raise SmsUnavailable("SMS is not configured on this server yet.")
    raise SmsUnavailable(f"SMS provider '{settings.SMS_PROVIDER}' is not implemented.")
