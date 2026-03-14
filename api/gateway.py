"""
FastAPI Gateway — full API surface for the Due Diligence Engine.
"""
import json
from pathlib import Path
from datetime import datetime, timezone
from bson import ObjectId, Binary
import bcrypt

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse

from utils.models import InvestorPortfolio, DueDiligenceResult, StartupProfile
from core.document_processor import extract_startup_profile
from core.pipeline import run_pipeline
from utils.db import (
    get_users_collection,
    get_applications_collection,
    get_collaborations_collection,
    get_collaboration_invites_collection,
)
from utils.linkedin_scraper import scrape_and_store_linkedin
from utils.email_sender import send_decision_email

app = FastAPI(
    title="AI Startup Due Diligence Engine",
    version="3.0.0",
    description="Structured AI-powered investment evaluation for startups.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _now():
    return datetime.now(timezone.utc)

def _oid(s: str) -> ObjectId:
    try:
        return ObjectId(s)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid ID format: {s}")


def _serialize_user(doc: dict) -> dict:
    doc = dict(doc)
    doc["_id"] = str(doc["_id"])
    doc.pop("password", None)
    if "created_at" in doc and isinstance(doc["created_at"], datetime):
        doc["created_at"] = doc["created_at"].isoformat()
    return doc


def _serialize_app(doc: dict) -> dict:
    doc = dict(doc)
    doc["_id"] = str(doc["_id"])
    doc.pop("pitch_deck", None)
    doc.pop("financials", None)
    doc.pop("founder_profile", None)
    if "created_at" in doc and isinstance(doc["created_at"], datetime):
        doc["created_at"] = doc["created_at"].isoformat()
    return doc


def _serialize_collab(doc: dict) -> dict:
    doc = dict(doc)
    doc["_id"] = str(doc["_id"])
    if "created_at" in doc and isinstance(doc["created_at"], datetime):
        doc["created_at"] = doc["created_at"].isoformat()
    for c in doc.get("collaborators", []):
        if "joined_at" in c and isinstance(c["joined_at"], datetime):
            c["joined_at"] = c["joined_at"].isoformat()
    return doc


def _build_portfolio_from_investor(investor: dict) -> InvestorPortfolio:
    return InvestorPortfolio(
        investor_type=investor.get("investor_type", "EARLY_VC"),
        portfolio_sectors=investor.get("sectors", []),
        portfolio_stages=investor.get("stages", []),
        portfolio_geographies=investor.get("geographies", []),
        check_size_range_usd=tuple(investor.get("check_size_range_usd", [100000, 1000000])),
        total_investments=investor.get("total_investments", 0),
        target_max_sector_concentration_pct=investor.get("max_sector_concentration_pct", 30.0),
    )


async def _run_analysis_on_app(app_doc: dict, investor: dict) -> dict:
    """Shared analysis logic: scrape LinkedIn, extract profile, run pipeline."""
    linkedin_url = app_doc.get("linkedin_url")
    if linkedin_url:
        scrape_and_store_linkedin(linkedin_url)

    deck_bytes = bytes(app_doc["pitch_deck"])
    fin_bytes = bytes(app_doc["financials"])
    founder_bytes = bytes(app_doc["founder_profile"])
    fin_filename = app_doc.get("financials_filename", "financials.csv")

    try:
        startup = extract_startup_profile(
            deck_bytes=deck_bytes,
            financial_bytes=fin_bytes,
            financial_filename=fin_filename,
            founder_bytes=founder_bytes,
        )
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Document extraction failed: {e}")

    portfolio = _build_portfolio_from_investor(investor)

    try:
        result = await run_pipeline(startup, portfolio)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline execution failed: {e}")

    return result.model_dump()


# ═══════════════════════════════════════════════════════════════════════════════
# HEALTH
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


# ═══════════════════════════════════════════════════════════════════════════════
# AUTH
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/auth/register")
async def register(payload: str = Form(None)):
    if not payload:
        raise HTTPException(status_code=422, detail="Missing registration data")
    data = json.loads(payload)

    email = data.get("email", "").strip().lower()
    password = data.get("password", "").strip()
    name = data.get("name", "").strip()
    role = data.get("role", "").strip().lower()

    if not email or not password or not name:
        raise HTTPException(status_code=422, detail="email, password, and name are required")
    if role not in ("investor", "entrepreneur"):
        raise HTTPException(status_code=422, detail="role must be 'investor' or 'entrepreneur'")

    users = get_users_collection()
    if users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="Email already registered")

    hashed_pw = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    user_doc = {
        "email": email, "password": hashed_pw, "name": name,
        "role": role, "created_at": _now(),
    }
    if role == "investor":
        user_doc.update({
            "investor_type": data.get("investor_type", "EARLY_VC"),
            "sectors": data.get("sectors", []),
            "stages": data.get("stages", []),
            "geographies": data.get("geographies", []),
            "check_size_range_usd": data.get("check_size_range_usd", [100000, 1000000]),
            "total_investments": data.get("total_investments", 0),
            "max_sector_concentration_pct": data.get("max_sector_concentration_pct", 30.0),
        })

    result = users.insert_one(user_doc)
    user_doc["_id"] = result.inserted_id
    return _serialize_user(user_doc)


@app.post("/auth/login")
async def login(payload: str = Form(...)):
    data = json.loads(payload)
    email = data.get("email", "").strip().lower()
    password = data.get("password", "").strip()
    if not email or not password:
        raise HTTPException(status_code=422, detail="email and password required")

    users = get_users_collection()
    user = users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    stored_pw = user["password"]
    # Support both bcrypt hashed and legacy plaintext passwords
    if stored_pw.startswith("$2"):
        # bcrypt hash
        if not bcrypt.checkpw(password.encode("utf-8"), stored_pw.encode("utf-8")):
            raise HTTPException(status_code=401, detail="Invalid credentials")
    else:
        # Legacy plaintext — verify and upgrade to bcrypt
        if stored_pw != password:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        # Upgrade: hash the plaintext password in-place
        new_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        users.update_one({"_id": user["_id"]}, {"$set": {"password": new_hash}})

    return _serialize_user(user)


# ═══════════════════════════════════════════════════════════════════════════════
# INVESTORS LIST
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/investors")
async def list_investors():
    users = get_users_collection()
    investors = list(users.find({"role": "investor"}))
    return [_serialize_user(inv) for inv in investors]


# ═══════════════════════════════════════════════════════════════════════════════
# APPLICATIONS
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/applications")
async def submit_application(
    investor_id: str = Form(...),
    entrepreneur_id: str = Form(...),
    entrepreneur_name: str = Form(...),
    company_name: str = Form("Unnamed Startup"),
    linkedin_url: str = Form(...),
    pitch_deck: UploadFile = File(...),
    financials: UploadFile = File(...),
    founder_profile: UploadFile = File(...),
):
    """Entrepreneur submits an application to a specific investor."""
    users = get_users_collection()
    investor = users.find_one({"_id": _oid(investor_id), "role": "investor"})
    if not investor:
        raise HTTPException(status_code=404, detail="Investor not found")

    deck_bytes = await pitch_deck.read()
    fin_bytes = await financials.read()
    founder_bytes = await founder_profile.read()

    app_doc = {
        "entrepreneur_id": entrepreneur_id,
        "entrepreneur_name": entrepreneur_name,
        "investor_id": investor_id,
        "investor_name": investor.get("name", ""),
        "company_name": company_name,
        "linkedin_url": linkedin_url,
        "status": "pending",
        "pitch_deck": Binary(deck_bytes),
        "financials": Binary(fin_bytes),
        "founder_profile": Binary(founder_bytes),
        "pitch_deck_filename": pitch_deck.filename or "pitch_deck.pdf",
        "financials_filename": financials.filename or "financials.csv",
        "founder_profile_filename": founder_profile.filename or "founder_profile.pdf",
        "analysis_result": None,
        "created_at": _now(),
    }

    apps = get_applications_collection()
    result = apps.insert_one(app_doc)
    app_doc["_id"] = result.inserted_id
    return _serialize_app(app_doc)


@app.get("/applications/investor/{investor_id}")
async def get_investor_applications(investor_id: str):
    """Return all applications this investor owns PLUS any they've been invited to collaborate on."""
    apps = get_applications_collection()
    # Direct applications
    direct = list(apps.find({"investor_id": investor_id}))
    result = [_serialize_app(d) for d in direct]

    # Collaboration-invite applications (new invite workflow)
    invites_col = get_collaboration_invites_collection()
    invites = list(invites_col.find({"collaborator_investor_id": investor_id}))
    for invite in invites:
        app_doc = apps.find_one({"_id": _oid(invite["application_id"])})
        if not app_doc:
            continue
        serialized = _serialize_app(app_doc)
        # Augment with collaboration context
        serialized["is_collab_invite"] = True
        serialized["collab_invite_id"] = str(invite["_id"])
        serialized["collab_invite_status"] = invite.get("status", "INVITED")
        serialized["collab_invited_by_name"] = invite.get("invited_by_investor_name", "")
        # Attach this collaborator's own analysis result if they've assessed
        serialized["collab_analysis_result"] = invite.get("analysis_result", None)
        result.append(serialized)

    return result


@app.get("/applications/entrepreneur/{entrepreneur_id}")
async def get_entrepreneur_applications(entrepreneur_id: str):
    apps = get_applications_collection()
    docs = list(apps.find({"entrepreneur_id": entrepreneur_id}))
    return [_serialize_app(d) for d in docs]


@app.post("/applications/{app_id}/analyze")
async def analyze_application(app_id: str):
    """Investor triggers the analysis pipeline on a submitted application."""
    apps = get_applications_collection()
    app_doc = apps.find_one({"_id": _oid(app_id)})
    if not app_doc:
        raise HTTPException(status_code=404, detail="Application not found")

    users = get_users_collection()
    investor = users.find_one({"_id": _oid(app_doc["investor_id"])})
    if not investor:
        raise HTTPException(status_code=404, detail="Investor not found")

    result_dict = await _run_analysis_on_app(app_doc, investor)

    apps.update_one(
        {"_id": _oid(app_id)},
        {"$set": {"status": "analyzed", "analysis_result": result_dict}},
    )
    return result_dict


@app.post("/applications/{app_id}/decision")
async def set_application_decision(app_id: str, payload: str = Form(...)):
    """Investor accepts or rejects an analyzed application.

    Statuses: PENDING/analyzed -> ACCEPTED or REJECTED (final).
    Once a decision is made it cannot be changed.
    """
    data = json.loads(payload)
    decision = data.get("decision")  # "accepted" | "rejected"
    message = data.get("message", "")

    if decision not in ("accepted", "rejected"):
        raise HTTPException(status_code=422, detail="decision must be 'accepted' or 'rejected'")

    apps = get_applications_collection()
    app_doc = apps.find_one({"_id": _oid(app_id)})
    if not app_doc:
        raise HTTPException(status_code=404, detail="Application not found")

    # ── Guard: decision is final — no re-entry ────────────────────────────
    current_status = app_doc.get("status", "")
    if current_status in ("ACCEPTED", "REJECTED"):
        raise HTTPException(
            status_code=409,
            detail=f"Decision already made: {current_status}. Cannot change.",
        )

    # Map to DB status
    db_status = "ACCEPTED" if decision == "accepted" else "REJECTED"

    apps.update_one(
        {"_id": _oid(app_id)},
        {"$set": {
            "status": db_status,
            "decision_message": message,
            "decision_timestamp": _now(),
        }},
    )

    # ── Email notification to entrepreneur ────────────────────────────────
    try:
        entrepreneur_id = app_doc.get("entrepreneur_id")
        company_name = app_doc.get("company_name", "your startup")
        investor_name = app_doc.get("investor_name", "")
        if entrepreneur_id:
            users = get_users_collection()
            entrepreneur = users.find_one({"_id": _oid(entrepreneur_id)})
            if entrepreneur and entrepreneur.get("email"):
                # Map ACCEPTED/REJECTED -> approved/rejected for email templates
                email_decision = "approved" if db_status == "ACCEPTED" else "rejected"
                send_decision_email(
                    to_email=entrepreneur["email"],
                    company_name=company_name,
                    decision=email_decision,
                    message=message,
                    investor_name=investor_name,
                )
    except Exception as e:
        print(f"⚠️  Email notification failed (non-blocking): {e}")

    updated = apps.find_one({"_id": _oid(app_id)})
    return _serialize_app(updated)


# ═══════════════════════════════════════════════════════════════════════════════
# COLLABORATIONS
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/collaborations")
async def create_collaboration(payload: str = Form(...)):
    """Lead investor creates a collaboration for an application."""
    data = json.loads(payload)
    app_id = data.get("application_id")
    lead_id = data.get("lead_investor_id")
    lead_name = data.get("lead_investor_name")

    if not app_id or not lead_id:
        raise HTTPException(status_code=422, detail="application_id and lead_investor_id required")

    apps = get_applications_collection()
    app_doc = apps.find_one({"_id": _oid(app_id)})
    if not app_doc:
        raise HTTPException(status_code=404, detail="Application not found")

    collabs = get_collaborations_collection()
    existing = collabs.find_one({"application_id": app_id})
    if existing:
        return _serialize_collab(existing)

    collab_doc = {
        "application_id": app_id,
        "company_name": app_doc.get("company_name", ""),
        "entrepreneur_name": app_doc.get("entrepreneur_name", ""),
        "linkedin_url": app_doc.get("linkedin_url", ""),
        "lead_investor_id": lead_id,
        "lead_investor_name": lead_name or "",
        "collaborators": [],
        "created_at": _now(),
    }
    result = collabs.insert_one(collab_doc)
    collab_doc["_id"] = result.inserted_id
    return _serialize_collab(collab_doc)


@app.get("/collaborations/application/{app_id}")
async def get_collaboration_for_app(app_id: str):
    collabs = get_collaborations_collection()
    doc = collabs.find_one({"application_id": app_id})
    if not doc:
        return None
    return _serialize_collab(doc)


@app.post("/collaborations/{collab_id}/invite")
async def invite_collaborator(collab_id: str, payload: str = Form(...)):
    """Invite another investor to the collaboration."""
    data = json.loads(payload)
    investor_id = data.get("investor_id")
    investor_name = data.get("investor_name", "")

    if not investor_id:
        raise HTTPException(status_code=422, detail="investor_id required")

    collabs = get_collaborations_collection()
    collab = collabs.find_one({"_id": _oid(collab_id)})
    if not collab:
        raise HTTPException(status_code=404, detail="Collaboration not found")

    # Check not already invited
    for c in collab.get("collaborators", []):
        if c["investor_id"] == investor_id:
            raise HTTPException(status_code=409, detail="Investor already invited")

    collaborator = {
        "investor_id": investor_id,
        "investor_name": investor_name,
        "status": "invited",
        "analysis_result": None,
        "joined_at": _now(),
    }

    collabs.update_one(
        {"_id": _oid(collab_id)},
        {"$push": {"collaborators": collaborator}},
    )

    updated = collabs.find_one({"_id": _oid(collab_id)})
    return _serialize_collab(updated)


@app.post("/collaborations/{collab_id}/assess/{investor_id}")
async def assess_as_collaborator(collab_id: str, investor_id: str):
    """A co-investor runs their own assessment on the application."""
    collabs = get_collaborations_collection()
    collab = collabs.find_one({"_id": _oid(collab_id)})
    if not collab:
        raise HTTPException(status_code=404, detail="Collaboration not found")

    # Verify this investor is a collaborator
    found = False
    for c in collab.get("collaborators", []):
        if c["investor_id"] == investor_id:
            found = True
            break
    if not found:
        raise HTTPException(status_code=403, detail="You are not a collaborator on this deal")

    # Get the application
    apps = get_applications_collection()
    app_doc = apps.find_one({"_id": _oid(collab["application_id"])})
    if not app_doc:
        raise HTTPException(status_code=404, detail="Application not found")

    # Get this investor's profile
    users = get_users_collection()
    investor = users.find_one({"_id": _oid(investor_id)})
    if not investor:
        raise HTTPException(status_code=404, detail="Investor not found")

    result_dict = await _run_analysis_on_app(app_doc, investor)

    # Update the collaborator's entry
    collabs.update_one(
        {"_id": _oid(collab_id), "collaborators.investor_id": investor_id},
        {"$set": {
            "collaborators.$.status": "assessed",
            "collaborators.$.analysis_result": result_dict,
        }},
    )

    return result_dict


@app.get("/collaborations/investor/{investor_id}")
async def get_collaborations_for_investor(investor_id: str):
    """Get all collaborations where this investor is lead or collaborator."""
    collabs = get_collaborations_collection()
    docs = list(collabs.find({
        "$or": [
            {"lead_investor_id": investor_id},
            {"collaborators.investor_id": investor_id},
        ]
    }))
    return [_serialize_collab(d) for d in docs]


# ═══════════════════════════════════════════════════════════════════════════════
# COLLABORATION INVITES (new invite-based workflow)
# ═══════════════════════════════════════════════════════════════════════════════

def _serialize_invite(doc: dict) -> dict:
    doc = dict(doc)
    doc["_id"] = str(doc["_id"])
    for dt_field in ("created_at", "decision_timestamp"):
        if dt_field in doc and isinstance(doc[dt_field], datetime):
            doc[dt_field] = doc[dt_field].isoformat()
    return doc


@app.post("/collaborations/invite")
async def invite_collaborator_new(payload: str = Form(...)):
    """An accepted investor invites another investor to collaborate on a deal.

    Edge-case guards enforced:
    1. Inviting investor must have ACCEPTED status on this application.
    2. Collaborator must not already have REJECTED status (as direct investor).
    3. No duplicate invites for the same collaborator on the same application.
    4. Collaborator cannot be the same as the inviting investor.
    """
    data = json.loads(payload)
    application_id = data.get("application_id")
    inviting_investor_id = data.get("inviting_investor_id")
    collaborator_investor_id = data.get("collaborator_investor_id")

    if not application_id or not inviting_investor_id or not collaborator_investor_id:
        raise HTTPException(
            status_code=422,
            detail="application_id, inviting_investor_id, and collaborator_investor_id are required",
        )

    # ── Guard 4: Cannot invite yourself ───────────────────────────────────
    if inviting_investor_id == collaborator_investor_id:
        raise HTTPException(status_code=422, detail="Cannot invite yourself as a collaborator")

    # ── Verify application exists ─────────────────────────────────────────
    apps = get_applications_collection()
    app_doc = apps.find_one({"_id": _oid(application_id)})
    if not app_doc:
        raise HTTPException(status_code=404, detail="Application not found")

    # ── Guard 1: Inviting investor must have ACCEPTED status ──────────────
    if app_doc.get("investor_id") != inviting_investor_id:
        # Check if this investor has any ACCEPTED application for the same startup
        inv_app = apps.find_one({
            "investor_id": inviting_investor_id,
            "company_name": app_doc.get("company_name"),
            "entrepreneur_id": app_doc.get("entrepreneur_id"),
            "status": "ACCEPTED",
        })
        if not inv_app:
            raise HTTPException(
                status_code=403,
                detail="Only investors who have ACCEPTED this startup can invite collaborators",
            )
    else:
        if app_doc.get("status") != "ACCEPTED":
            raise HTTPException(
                status_code=403,
                detail="Only investors who have ACCEPTED this startup can invite collaborators",
            )

    # ── Guard 2: Collaborator must not be a REJECTED investor ─────────────
    rejected_app = apps.find_one({
        "investor_id": collaborator_investor_id,
        "company_name": app_doc.get("company_name"),
        "entrepreneur_id": app_doc.get("entrepreneur_id"),
        "status": "REJECTED",
    })
    if rejected_app:
        raise HTTPException(
            status_code=409,
            detail="Cannot invite an investor who has already rejected this startup",
        )

    # ── Guard 3: No duplicate invites ─────────────────────────────────────
    invites = get_collaboration_invites_collection()
    existing = invites.find_one({
        "application_id": application_id,
        "collaborator_investor_id": collaborator_investor_id,
    })
    if existing:
        raise HTTPException(
            status_code=409,
            detail="This investor has already been invited for this deal",
        )

    # Also check if collaborator was previously COLLAB_REJECTED for any app
    # of the same startup
    collab_rejected = invites.find_one({
        "startup_company_name": app_doc.get("company_name"),
        "entrepreneur_id": app_doc.get("entrepreneur_id"),
        "collaborator_investor_id": collaborator_investor_id,
        "status": "COLLAB_REJECTED",
    })
    if collab_rejected:
        raise HTTPException(
            status_code=409,
            detail="Cannot invite an investor who has already rejected collaboration for this startup",
        )

    # ── Look up investor names ────────────────────────────────────────────
    users = get_users_collection()
    inviting_investor = users.find_one({"_id": _oid(inviting_investor_id)})
    collaborator_investor = users.find_one({"_id": _oid(collaborator_investor_id)})

    if not collaborator_investor or collaborator_investor.get("role") != "investor":
        raise HTTPException(status_code=404, detail="Collaborator investor not found")

    invite_doc = {
        "application_id": application_id,
        "startup_company_name": app_doc.get("company_name", ""),
        "entrepreneur_id": app_doc.get("entrepreneur_id", ""),
        "invited_by_investor_id": inviting_investor_id,
        "invited_by_investor_name": inviting_investor.get("name", "") if inviting_investor else "",
        "collaborator_investor_id": collaborator_investor_id,
        "collaborator_investor_name": collaborator_investor.get("name", ""),
        "status": "INVITED",
        "created_at": _now(),
        "decision_timestamp": None,
    }

    result = invites.insert_one(invite_doc)
    invite_doc["_id"] = result.inserted_id
    return _serialize_invite(invite_doc)


@app.post("/collaborations/invites/{invite_id}/assess")
async def assess_as_collab_invitee(invite_id: str):
    """An invited collaborator runs the AI analysis with their own investor profile.

    Updates the analysis_result on the invite document and sets status to COLLAB_ASSESSED.
    This must be done before the collaborator can accept or reject.
    """
    invites = get_collaboration_invites_collection()
    invite = invites.find_one({"_id": _oid(invite_id)})
    if not invite:
        raise HTTPException(status_code=404, detail="Collaboration invite not found")

    if invite.get("status") not in ("INVITED", "COLLAB_ASSESSED"):
        raise HTTPException(
            status_code=409,
            detail=f"Cannot assess: invite status is {invite.get('status')}",
        )

    # Get the application
    apps = get_applications_collection()
    app_doc = apps.find_one({"_id": _oid(invite["application_id"])})
    if not app_doc:
        raise HTTPException(status_code=404, detail="Application not found")

    # Use the collaborator's own investor profile for analysis
    users = get_users_collection()
    investor = users.find_one({"_id": _oid(invite["collaborator_investor_id"])})
    if not investor:
        raise HTTPException(status_code=404, detail="Collaborator investor not found")

    result_dict = await _run_analysis_on_app(app_doc, investor)

    invites.update_one(
        {"_id": _oid(invite_id)},
        {"$set": {
            "status": "COLLAB_ASSESSED",
            "analysis_result": result_dict,
        }},
    )
    return result_dict


@app.post("/collaborations/invites/{invite_id}/decide")
async def decide_collaboration_invite(invite_id: str, payload: str = Form(...)):
    """Collaborator investor accepts or rejects a collaboration invitation.

    Must have assessed first (status = COLLAB_ASSESSED).
    Once decided, the decision is final.
    """
    data = json.loads(payload)
    decision = data.get("decision")  # "accept" | "reject"

    if decision not in ("accept", "reject"):
        raise HTTPException(status_code=422, detail="decision must be 'accept' or 'reject'")

    invites = get_collaboration_invites_collection()
    invite = invites.find_one({"_id": _oid(invite_id)})
    if not invite:
        raise HTTPException(status_code=404, detail="Collaboration invite not found")

    current = invite.get("status", "")
    # ── Guard: must have assessed before deciding ─────────────────────────
    if current == "INVITED":
        raise HTTPException(
            status_code=409,
            detail="You must assess the application before making a decision.",
        )
    # ── Guard: cannot re-decide ───────────────────────────────────────────
    if current in ("COLLAB_ACCEPTED", "COLLAB_REJECTED"):
        raise HTTPException(
            status_code=409,
            detail=f"Decision already made: {current}. Cannot change.",
        )

    new_status = "COLLAB_ACCEPTED" if decision == "accept" else "COLLAB_REJECTED"

    invites.update_one(
        {"_id": _oid(invite_id)},
        {"$set": {
            "status": new_status,
            "decision_timestamp": _now(),
        }},
    )

    # ── On ACCEPT: persist into collaborations collection ─────────────────
    if new_status == "COLLAB_ACCEPTED":
        collabs = get_collaborations_collection()
        # Only insert once (guard against re-runs)
        existing_collab = collabs.find_one({
            "invite_id": invite_id,
        })
        if not existing_collab:
            collab_doc = {
                "invite_id": invite_id,
                "application_id": invite.get("application_id"),
                "startup_company_name": invite.get("startup_company_name", ""),
                "entrepreneur_id": invite.get("entrepreneur_id", ""),
                "invited_by_investor_id": invite.get("invited_by_investor_id"),
                "invited_by_investor_name": invite.get("invited_by_investor_name", ""),
                "collaborator_investor_id": invite.get("collaborator_investor_id"),
                "collaborator_investor_name": invite.get("collaborator_investor_name", ""),
                "status": "COLLAB_ACCEPTED",
                "created_at": _now(),
            }
            collabs.insert_one(collab_doc)

    updated = invites.find_one({"_id": _oid(invite_id)})
    return _serialize_invite(updated)


@app.get("/collaborations/hub/{investor_id}")
async def get_collaboration_hub(investor_id: str):
    """Return all decided collaboration invites (sent OR received) for the hub.

    Includes both COLLAB_ACCEPTED and COLLAB_REJECTED so both parties can see
    the full history of collaboration decisions.
    """
    invites = get_collaboration_invites_collection()
    docs = list(invites.find({
        "$or": [
            {"invited_by_investor_id": investor_id},
            {"collaborator_investor_id": investor_id},
        ],
        "status": {"$in": ["COLLAB_ACCEPTED", "COLLAB_REJECTED"]},
    }))
    return [_serialize_invite(d) for d in docs]


@app.get("/collaborations/invites/investor/{investor_id}")
async def get_invites_for_investor(investor_id: str):
    """Get all collaboration invites where this investor is the collaborator."""
    invites = get_collaboration_invites_collection()
    docs = list(invites.find({"collaborator_investor_id": investor_id}))
    return [_serialize_invite(d) for d in docs]


@app.get("/collaborations/invites/sent/{investor_id}")
async def get_invites_sent_by_investor(investor_id: str):
    """Get all collaboration invites sent by this investor."""
    invites = get_collaboration_invites_collection()
    docs = list(invites.find({"invited_by_investor_id": investor_id}))
    return [_serialize_invite(d) for d in docs]


@app.get("/applications/{app_id}/deal-summary")
async def get_deal_summary(app_id: str):
    """Get the full deal summary for an application.

    Returns:
    - All investors for this startup with their statuses
    - All collaboration invites with statuses and who invited whom
    - List of active (participating) investors
    """
    apps = get_applications_collection()
    app_doc = apps.find_one({"_id": _oid(app_id)})
    if not app_doc:
        raise HTTPException(status_code=404, detail="Application not found")

    company_name = app_doc.get("company_name")
    entrepreneur_id = app_doc.get("entrepreneur_id")

    # ── All investor applications for this startup ────────────────────────
    all_apps = list(apps.find({
        "company_name": company_name,
        "entrepreneur_id": entrepreneur_id,
    }))

    investors = []
    active_investors = []
    for a in all_apps:
        status = a.get("status", "pending").upper()
        # Normalize: "pending" and "analyzed" both map to PENDING for the summary
        if status in ("PENDING", "ANALYZED"):
            display_status = "PENDING"
        elif status == "ACCEPTED":
            display_status = "ACCEPTED"
        elif status == "REJECTED":
            display_status = "REJECTED"
        else:
            display_status = status.upper()

        investor_info = {
            "application_id": str(a["_id"]),
            "investor_id": a.get("investor_id"),
            "investor_name": a.get("investor_name"),
            "status": display_status,
        }
        investors.append(investor_info)

        if display_status == "ACCEPTED":
            active_investors.append({
                "investor_id": a.get("investor_id"),
                "investor_name": a.get("investor_name"),
                "role": "direct_investor",
            })

    # ── All collaboration invites for this startup ────────────────────────
    invites_col = get_collaboration_invites_collection()
    all_invites = list(invites_col.find({
        "startup_company_name": company_name,
        "entrepreneur_id": entrepreneur_id,
    }))

    collaborators = []
    for inv in all_invites:
        collab_info = {
            "invite_id": str(inv["_id"]),
            "collaborator_investor_id": inv.get("collaborator_investor_id"),
            "collaborator_investor_name": inv.get("collaborator_investor_name"),
            "invited_by_investor_id": inv.get("invited_by_investor_id"),
            "invited_by_investor_name": inv.get("invited_by_investor_name"),
            "status": inv.get("status"),
        }
        collaborators.append(collab_info)

        if inv.get("status") == "COLLAB_ACCEPTED":
            active_investors.append({
                "investor_id": inv.get("collaborator_investor_id"),
                "investor_name": inv.get("collaborator_investor_name"),
                "role": "collaborator",
                "invited_by": inv.get("invited_by_investor_name"),
            })

    return {
        "company_name": company_name,
        "entrepreneur_id": entrepreneur_id,
        "investors": investors,
        "collaborators": collaborators,
        "active_investors": active_investors,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# LEGACY ENDPOINTS (preserved exactly)
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/extract-profile")
async def redirect_extract_profile():
    return RedirectResponse(url="/")

@app.get("/analyze")
async def redirect_analyze():
    return RedirectResponse(url="/")

@app.post("/extract-profile", response_model=StartupProfile)
async def extract_profile(
    pitch_deck: UploadFile = File(...),
    financials: UploadFile = File(...),
    founder_profile: UploadFile = File(...),
) -> StartupProfile:
    deck_bytes = await pitch_deck.read()
    financial_bytes = await financials.read()
    founder_bytes = await founder_profile.read()
    try:
        profile = extract_startup_profile(
            deck_bytes=deck_bytes, financial_bytes=financial_bytes,
            financial_filename=financials.filename or "financials.csv",
            founder_bytes=founder_bytes,
        )
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Document extraction failed: {e}")
    return profile

@app.post("/analyze", response_model=DueDiligenceResult)
async def analyze(
    pitch_deck: UploadFile = File(...),
    financials: UploadFile = File(...),
    founder_profile: UploadFile = File(...),
    portfolio: str = Form(...),
) -> DueDiligenceResult:
    try:
        portfolio_data = json.loads(portfolio)
        investor_portfolio = InvestorPortfolio(**portfolio_data)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Invalid portfolio JSON: {e}")
    deck_bytes = await pitch_deck.read()
    financial_bytes = await financials.read()
    founder_bytes = await founder_profile.read()
    try:
        startup = extract_startup_profile(
            deck_bytes=deck_bytes, financial_bytes=financial_bytes,
            financial_filename=financials.filename or "financials.csv",
            founder_bytes=founder_bytes,
        )
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Document extraction failed: {e}")
    try:
        result = await run_pipeline(startup, investor_portfolio)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline execution failed: {e}")
    return result


# ═══════════════════════════════════════════════════════════════════════════════
# SERVE FRONTEND
# ═══════════════════════════════════════════════════════════════════════════════

_frontend_dir = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if _frontend_dir.is_dir():
    app.mount("/", StaticFiles(directory=str(_frontend_dir), html=True), name="frontend")
