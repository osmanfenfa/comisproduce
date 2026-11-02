"""
Server-side verification of Google OAuth access tokens.

The frontend signs in with Google Identity Services and sends us the access
token. We never trust the email/sub the browser sends: we ask Google who the
token belongs to and check it was issued to *our* OAuth client, so a token
obtained by another app can't be replayed here.
"""
import json
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from app.core.config import settings

TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"


class GoogleAuthError(Exception):
    pass


@dataclass
class GoogleIdentity:
    sub: str
    email: str


def verify_google_access_token(access_token: str) -> GoogleIdentity:
    if not settings.GOOGLE_CLIENT_ID:
        raise GoogleAuthError("Google Sign-In is not configured on this server.")

    url = f"{TOKENINFO_URL}?{urllib.parse.urlencode({'access_token': access_token})}"
    try:
        with urllib.request.urlopen(url, timeout=8) as resp:
            info = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError:
        raise GoogleAuthError("Google rejected the sign-in token.")
    except Exception:
        raise GoogleAuthError("Could not reach Google to verify sign-in. Please try again.")

    if settings.GOOGLE_CLIENT_ID not in (info.get("aud"), info.get("azp")):
        raise GoogleAuthError("Sign-in token was not issued for this application.")
    if str(info.get("email_verified")).lower() != "true" or not info.get("email"):
        raise GoogleAuthError("Your Google account has no verified email address.")
    if not info.get("sub"):
        raise GoogleAuthError("Google did not return an account id.")
    try:
        if int(info.get("expires_in", "0")) <= 0:
            raise GoogleAuthError("Sign-in token has expired.")
    except ValueError:
        raise GoogleAuthError("Sign-in token has expired.")

    return GoogleIdentity(sub=info["sub"], email=info["email"].strip().lower())
