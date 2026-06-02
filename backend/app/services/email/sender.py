"""Email sender service — delivers plain-text emails via SMTP."""

import smtplib
import uuid
from email.message import EmailMessage
from email.utils import formatdate, formataddr
from pathlib import Path

from app.core.config import settings

TEMPLATE_DIR = Path(__file__).parent / "templates"


def load_template(name: str, **kwargs: str) -> str:
    """Load and render a plain-text email template."""
    path = TEMPLATE_DIR / name
    content = path.read_text()
    return content.format(**kwargs)


def send_email(
    to: str,
    subject: str,
    body: str,
    attachment: tuple[str, str, str] | None = None,
) -> None:
    """Send a plain-text email via SMTP.

    attachment: optional (filename, content, mime_subtype) e.g. ("match.ics", ics_str, "calendar")
    """
    msg = EmailMessage()
    msg["From"] = formataddr(("REDZONE", settings.SMTP_FROM_ADDRESS))
    msg["To"] = to
    msg["Subject"] = subject
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = f"<{uuid.uuid4()}@redzone-soccer.com>"
    msg["Reply-To"] = settings.SMTP_FROM_ADDRESS
    msg["List-Unsubscribe"] = f"<mailto:{settings.SMTP_FROM_ADDRESS}?subject=unsubscribe>"
    msg.set_content(body)

    if attachment:
        filename, content, subtype = attachment
        if subtype == "calendar":
            msg.add_attachment(
                content.encode("utf-8"),
                maintype="text",
                subtype="calendar",
                filename=filename,
            )
            # Set method=PUBLISH on the calendar part so email clients
            # recognise it as a calendar invite rather than a generic file.
            for part in msg.iter_attachments():
                ct = part.get_content_type()
                if ct == "text/calendar":
                    part.set_param("method", "PUBLISH")
                    break
        else:
            msg.add_attachment(
                content.encode("utf-8"),
                maintype="text",
                subtype=subtype,
                filename=filename,
            )

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
