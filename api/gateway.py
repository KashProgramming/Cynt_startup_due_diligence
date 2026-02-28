"""
FastAPI Gateway — full API surface for the Due Diligence Engine.
"""
import json
from pathlib import Path
from datetime import datetime, timezone
from bson import ObjectId, Binary

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
)
from utils.linkedin_scraper import scrape_and_store_linkedin

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

    user_doc = {
        "email": email, "password": password, "name": name,
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
    if not user or user["password"] != password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
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
    apps = get_applications_collection()
    docs = list(apps.find({"investor_id": investor_id}))
    return [_serialize_app(d) for d in docs]


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
