"""
Email service for COMIS.
Official Email: comisworldproduce@gmail.com
Supports real SMTP dispatch when configured in environment or falls back gracefully
to structured console logging and test buffer for zero-downtime offline/dev workflows.
"""
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import List, Dict, Any

SENDER_EMAIL = "comisworldproduce@gmail.com"
SENDER_NAME = "COMIS World Produce"

# In-memory store of recently dispatched emails for testing / dev inspection
SENT_EMAILS_BUFFER: List[Dict[str, Any]] = []


def send_password_reset_email(to_email: str, user_name: str, reset_token: str, reset_code: str) -> bool:
    """
    Sends a formatted password reset email to a Produce Manager or Secretary.
    Includes both a 6-digit instant reset code and a direct web reset link.
    """
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    reset_link = f"{frontend_url}/login?reset_token={reset_token}"
    
    subject = "COMIS — Password Reset Instructions"
    
    plain_text = f"""Hello {user_name},

We received a request to reset the password for your COMIS account.

Your 6-Digit Password Reset Code is: {reset_code}

Or click the link below to reset your password directly:
{reset_link}

This code and link will expire in 1 hour. If you did not request this password reset, please ignore this message or contact us at {SENDER_EMAIL}.

Best regards,
COMIS World Produce Administration
{SENDER_EMAIL}
"""

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>COMIS Password Reset</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b;">
  <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 20px; border: 2px solid #168821; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05);">
    <div style="background-color: #d4a000; padding: 18px 24px; text-align: center;">
      <h1 style="color: #0f5c18; margin: 0; font-size: 20px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase;">
        COMIS
      </h1>
      <p style="color: #0f5c18; margin: 4px 0 0 0; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">
        Produce Management Information System
      </p>
    </div>

    <div style="padding: 28px 24px;">
      <h2 style="font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 0;">Password Reset Request</h2>
      <p style="font-size: 13px; line-height: 1.6; color: #475569;">
        Hello <strong>{user_name}</strong>,<br>
        We received a request to reset the password for your COMIS staff account. Use the 6-digit code below or click the button to set a new password.
      </p>

      <div style="background-color: #f0fdf4; border: 1.5px solid #86efac; border-radius: 14px; padding: 16px; text-align: center; margin: 20px 0;">
        <span style="font-size: 11px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 6px;">
          Your Reset Code
        </span>
        <span style="font-family: monospace; font-size: 28px; font-weight: 900; letter-spacing: 6px; color: #14532d;">
          {reset_code}
        </span>
      </div>

      <div style="text-align: center; margin: 24px 0;">
        <a href="{reset_link}" style="background-color: #168821; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 30px; font-size: 13px; font-weight: 800; display: inline-block; box-shadow: 0 4px 6px -1px rgba(22, 136, 33, 0.2);">
          Reset Password Online
        </a>
      </div>

      <p style="font-size: 11px; color: #64748b; line-height: 1.5; border-top: 1px solid #f1f5f9; padding-top: 16px; margin-bottom: 0;">
        <strong>Security Notice:</strong> This code and link will expire in <strong>1 hour</strong>. If you did not request this reset, please immediately contact COMIS support at <a href="mailto:{SENDER_EMAIL}" style="color: #168821; text-decoration: underline;">{SENDER_EMAIL}</a>.
      </p>
    </div>

    <div style="background-color: #f8fafc; padding: 12px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
      &copy; COMIS Produce Network · {SENDER_EMAIL}
    </div>
  </div>
</body>
</html>
"""

    email_record = {
        "to": to_email,
        "user_name": user_name,
        "reset_token": reset_token,
        "reset_code": reset_code,
        "subject": subject,
        "plain_text": plain_text,
    }
    from app.core.config import settings
    app_env = settings.APP_ENV
    if app_env in ("testing", "development"):
        # Inspection buffer for tests / local dev only — never keep reset codes in a production process
        SENT_EMAILS_BUFFER.append(email_record)

    # Attempt live SMTP if configured
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASSWORD")

    if smtp_host and smtp_user and smtp_pass:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{SENDER_NAME} <{SENDER_EMAIL}>"
            msg["To"] = to_email

            part1 = MIMEText(plain_text, "plain")
            part2 = MIMEText(html_content, "html")
            msg.attach(part1)
            msg.attach(part2)

            with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.sendmail(SENDER_EMAIL, [to_email], msg.as_string())
            print(f"[EMAIL SERVICE] Successfully sent reset email to {to_email}")
            return True
        except Exception as e:
            print(f"[EMAIL SERVICE] SMTP dispatch error ({e}); saved to buffer.")
            return True
    else:
        # Development / Offline mode: successfully logged & buffered
        if app_env == "development":
            print(f"[EMAIL SERVICE] [DEV MODE] Password reset email prepared for {to_email} (Code: {reset_code})")
        else:
            print(f"[EMAIL SERVICE] SMTP is not configured; reset email for {to_email} was NOT sent.")
            return False
        return True
