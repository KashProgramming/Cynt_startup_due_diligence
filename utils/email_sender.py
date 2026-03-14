"""
Email notification utility — sends verdict emails to entrepreneurs.
Uses SMTP (Gmail by default). Requires SMTP_EMAIL and SMTP_PASSWORD in .env.

Fails silently (logs error) so it never blocks the decision flow.
"""
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_EMAIL = os.getenv("SMTP_EMAIL", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")


def _build_approved_html(company_name: str, message: str, investor_name: str = "") -> str:
    investor_display = investor_name if investor_name else "one of our investors"
    return f"""
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 2rem;">
        <div style="text-align: center; margin-bottom: 2rem;">
            <h1 style="color: #2d3436; font-size: 1.8rem; margin-bottom: 0.3rem;">Cynt</h1>
            <p style="color: #999; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.1em;">Investment Intelligence</p>
        </div>
        <div style="background: #f0faf0; border: 1px solid #c6e6c6; border-radius: 12px; padding: 2rem; text-align: center;">
            <div style="font-size: 3rem; margin-bottom: 0.5rem;">🎉</div>
            <h2 style="color: #2d7d46; margin-bottom: 0.75rem;">Application Accepted!</h2>
            <p style="color: #333; font-size: 1.05rem; line-height: 1.7;">
                We're delighted to inform you that <strong>{company_name}</strong> has been <strong style="color: #2d7d46;">accepted</strong> by <strong>{investor_display}</strong> on the Cynt platform.
                This decision reflects genuine interest in your startup's vision and potential.
                Please review the message below and expect to be contacted shortly regarding next steps.
            </p>
            {f'<div style="margin-top: 1.5rem; padding: 1rem; background: #fff; border-radius: 8px; border: 1px solid #e0e0e0;"><p style="color: #555; font-size: 0.95rem; line-height: 1.6; margin: 0;">{message}</p></div>' if message else ''}
        </div>
        <p style="color: #999; font-size: 0.78rem; text-align: center; margin-top: 2rem;">
            This is an automated notification from Cynt. Please do not reply to this email.
        </p>
    </div>
    """


def _build_declined_html(company_name: str, message: str, investor_name: str = "") -> str:
    investor_display = investor_name if investor_name else "our investment team"
    return f"""
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 2rem;">
        <div style="text-align: center; margin-bottom: 2rem;">
            <h1 style="color: #2d3436; font-size: 1.8rem; margin-bottom: 0.3rem;">Cynt</h1>
            <p style="color: #999; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.1em;">Investment Intelligence</p>
        </div>
        <div style="background: #fef5f3; border: 1px solid #f0c6be; border-radius: 12px; padding: 2rem; text-align: center;">
            <div style="font-size: 3rem; margin-bottom: 0.5rem;">📋</div>
            <h2 style="color: #c1553b; margin-bottom: 0.75rem;">Application Update</h2>
            <p style="color: #333; font-size: 1.05rem; line-height: 1.7;">
                After careful consideration, <strong>{investor_display}</strong> has decided not to move forward with <strong>{company_name}</strong> at this time.
                We appreciate the effort you put into your application and encourage you to keep building — great startups take time.
                Please review the message below for specific feedback from the investor.
            </p>
            {f'<div style="margin-top: 1.5rem; padding: 1rem; background: #fff; border-radius: 8px; border: 1px solid #e0e0e0;"><p style="color: #555; font-size: 0.95rem; line-height: 1.6; margin: 0;">{message}</p></div>' if message else ''}
        </div>
        <p style="color: #999; font-size: 0.78rem; text-align: center; margin-top: 2rem;">
            This is an automated notification from Cynt. Please do not reply to this email.
        </p>
    </div>
    """


def send_decision_email(
    to_email: str,
    company_name: str,
    decision: str,
    message: str = "",
    investor_name: str = "",
) -> bool:
    """Send a verdict email to the entrepreneur.

    Args:
        to_email: Entrepreneur's email address.
        company_name: Name of the startup.
        decision: "approved" or "rejected".
        message: Optional investor message.
        investor_name: Name of the investor who made the decision.

    Returns:
        True if sent successfully, False otherwise.
    """
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        print("⚠️  SMTP_EMAIL / SMTP_PASSWORD not set — skipping email notification")
        return False

    try:
        subject = (
            f"🎉 Your application for {company_name} has been approved!"
            if decision == "approved"
            else f"📋 Update on your application for {company_name}"
        )

        html_body = (
            _build_approved_html(company_name, message, investor_name)
            if decision == "approved"
            else _build_declined_html(company_name, message, investor_name)
        )

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"Cynt <{SMTP_EMAIL}>"
        msg["To"] = to_email
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.sendmail(SMTP_EMAIL, to_email, msg.as_string())

        print(f"✅ Verdict email sent to {to_email} ({decision})")
        return True

    except Exception as e:
        print(f"⚠️  Failed to send email to {to_email}: {e}")
        return False
