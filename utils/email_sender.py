"""
Email notification utility — sends verdict emails to entrepreneurs.
Uses Resend API instead of SMTP (works on cloud platforms).
Requires RESEND_API_KEY and EMAIL_FROM in .env.

Fails silently (logs error) so it never blocks the decision flow.
"""

import os
import resend
from dotenv import load_dotenv

load_dotenv()

RESEND_API_KEY=os.getenv("RESEND_API_KEY","")
EMAIL_FROM=os.getenv("EMAIL_FROM","Cynt <onboarding@resend.dev>")

resend.api_key=RESEND_API_KEY


def _build_approved_html(company_name:str,message:str,investor_name:str="")->str:
    investor_display=investor_name if investor_name else "one of our investors"
    return f"""
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;padding:2rem;">
        <div style="text-align:center;margin-bottom:2rem;">
            <h1 style="color:#2d3436;font-size:1.8rem;margin-bottom:0.3rem;">Cynt</h1>
            <p style="color:#999;font-size:0.8rem;text-transform:uppercase;letter-spacing:0.1em;">Investment Intelligence</p>
        </div>
        <div style="background:#f0faf0;border:1px solid #c6e6c6;border-radius:12px;padding:2rem;text-align:center;">
            <div style="font-size:3rem;margin-bottom:0.5rem;">🎉</div>
            <h2 style="color:#2d7d46;margin-bottom:0.75rem;">Application Accepted!</h2>
            <p style="color:#333;font-size:1.05rem;line-height:1.7;">
                We're delighted to inform you that <strong>{company_name}</strong> has been <strong style="color:#2d7d46;">accepted</strong> by <strong>{investor_display}</strong> on the Cynt platform.
            </p>
            {f'<div style="margin-top:1.5rem;padding:1rem;background:#fff;border-radius:8px;border:1px solid #e0e0e0;"><p style="color:#555;font-size:0.95rem;line-height:1.6;margin:0;">{message}</p></div>' if message else ''}
        </div>
        <p style="color:#999;font-size:0.78rem;text-align:center;margin-top:2rem;">
            This is an automated notification from Cynt. Please do not reply to this email.
        </p>
    </div>
    """


def _build_declined_html(company_name:str,message:str,investor_name:str="")->str:
    investor_display=investor_name if investor_name else "our investment team"
    return f"""
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;padding:2rem;">
        <div style="text-align:center;margin-bottom:2rem;">
            <h1 style="color:#2d3436;font-size:1.8rem;margin-bottom:0.3rem;">Cynt</h1>
            <p style="color:#999;font-size:0.8rem;text-transform:uppercase;letter-spacing:0.1em;">Investment Intelligence</p>
        </div>
        <div style="background:#fef5f3;border:1px solid #f0c6be;border-radius:12px;padding:2rem;text-align:center;">
            <div style="font-size:3rem;margin-bottom:0.5rem;">📋</div>
            <h2 style="color:#c1553b;margin-bottom:0.75rem;">Application Update</h2>
            <p style="color:#333;font-size:1.05rem;line-height:1.7;">
                After careful consideration, <strong>{investor_display}</strong> has decided not to move forward with <strong>{company_name}</strong> at this time.
            </p>
            {f'<div style="margin-top:1.5rem;padding:1rem;background:#fff;border-radius:8px;border:1px solid #e0e0e0;"><p style="color:#555;font-size:0.95rem;line-height:1.6;margin:0;">{message}</p></div>' if message else ''}
        </div>
        <p style="color:#999;font-size:0.78rem;text-align:center;margin-top:2rem;">
            This is an automated notification from Cynt. Please do not reply to this email.
        </p>
    </div>
    """


def send_decision_email(
    to_email:str,
    company_name:str,
    decision:str,
    message:str="",
    investor_name:str=""
)->bool:
    """
    Send a verdict email to the entrepreneur.
    """

    if not RESEND_API_KEY:
        print("⚠️ RESEND_API_KEY not set — skipping email notification")
        return False

    try:

        subject=(
            f"🎉 Your application for {company_name} has been approved!"
            if decision=="approved"
            else f"📋 Update on your application for {company_name}"
        )

        html_body=(
            _build_approved_html(company_name,message,investor_name)
            if decision=="approved"
            else _build_declined_html(company_name,message,investor_name)
        )

        resend.Emails.send({
            "from":EMAIL_FROM,
            "to":to_email,
            "subject":subject,
            "html":html_body
        })

        print(f"✅ Verdict email sent to {to_email} ({decision})")
        return True

    except Exception as e:
        print(f"⚠️ Failed to send email to {to_email}: {e}")
        return False