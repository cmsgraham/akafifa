"""Email sender service — delivers plain-text emails via SMTP."""

import smtplib
from email.message import EmailMessage
from pathlib import Path

from app.core.config import settings

TEMPLATE_DIR = Path(__file__).parent / "templates"


def load_template(name: str, **kwargs: str) -> str:
    """Load and render a plain-text email template."""
    path = TEMPLATE_DIR / name
    content = path.read_text()
    return content.format(**kwargs)


def send_email(to: str, subject: str, body: str) -> None:
    """Send a plain-text email via SMTP."""
    msg = EmailMessage()
    msg["From"] = settings.SMTP_FROM_ADDRESS
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)

    if settings.SMTP_TLS_ENABLED:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            if settings.SMTP_USERNAME:
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.send_message(msg)
    else:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            if settings.SMTP_USERNAME:
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.send_message(msg)
