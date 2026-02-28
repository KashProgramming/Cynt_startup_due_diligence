"""
FastAPI Gateway — file intake, request routing, async orchestration.
Endpoints:
  POST /analyze         — full pipeline (file upload + portfolio JSON)
  POST /extract-profile — document extraction only (for preview/debug)
  GET  /health          — health check
"""
import json
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from utils.models import InvestorPortfolio, DueDiligenceResult, StartupProfile
from core.document_processor import extract_startup_profile
from core.pipeline import run_pipeline

app = FastAPI(
    title="AI Startup Due Diligence Engine",
    version="1.0.0",
    description="Structured AI-powered investment evaluation for startups.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict to frontend domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict:
    """Health check endpoint.

    Returns:
        dict: Status message.
    """
    return {"status": "ok"}


from fastapi.responses import RedirectResponse

@app.get("/extract-profile")
async def redirect_extract_profile():
    return RedirectResponse(url="/")


@app.get("/analyze")
async def redirect_analyze():
    return RedirectResponse(url="/")


@app.post("/extract-profile", response_model=StartupProfile)
async def extract_profile(
    pitch_deck: UploadFile = File(..., description="Pitch deck PDF"),
    financials: UploadFile = File(..., description="Financial sheet (CSV or XLSX)"),
    founder_profile: UploadFile = File(..., description="Founder profile PDF"),
) -> StartupProfile:
    """Extract structured startup profile from uploaded documents.

    Args:
        pitch_deck: Pitch deck PDF file.
        financials: CSV or XLSX financial sheet.
        founder_profile: Founder profile PDF.

    Returns:
        StartupProfile: Extracted and validated startup data.
    """
    deck_bytes = await pitch_deck.read()
    financial_bytes = await financials.read()
    founder_bytes = await founder_profile.read()

    try:
        profile = extract_startup_profile(
            deck_bytes=deck_bytes,
            financial_bytes=financial_bytes,
            financial_filename=financials.filename or "financials.csv",
            founder_bytes=founder_bytes,
        )
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Document extraction failed: {e}")

    return profile


@app.post("/analyze", response_model=DueDiligenceResult)
async def analyze(
    pitch_deck: UploadFile = File(..., description="Pitch deck PDF"),
    financials: UploadFile = File(..., description="Financial sheet (CSV or XLSX)"),
    founder_profile: UploadFile = File(..., description="Founder profile PDF"),
    portfolio: str = Form(..., description="InvestorPortfolio JSON string"),
) -> DueDiligenceResult:
    """Run the full due diligence pipeline on a startup.

    Args:
        pitch_deck: Pitch deck PDF.
        financials: Financial sheet (CSV or XLSX).
        founder_profile: Founder profile PDF.
        portfolio: JSON string representing the investor's InvestorPortfolio.

    Returns:
        DueDiligenceResult: Complete due diligence output with memo.
    """
    # Parse portfolio
    try:
        portfolio_data = json.loads(portfolio)
        investor_portfolio = InvestorPortfolio(**portfolio_data)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Invalid portfolio JSON: {e}")

    # Read files
    deck_bytes = await pitch_deck.read()
    financial_bytes = await financials.read()
    founder_bytes = await founder_profile.read()

    # Extract structured profile
    try:
        startup = extract_startup_profile(
            deck_bytes=deck_bytes,
            financial_bytes=financial_bytes,
            financial_filename=financials.filename or "financials.csv",
            founder_bytes=founder_bytes,
        )
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Document extraction failed: {e}")

    # Run full pipeline
    try:
        result = await run_pipeline(startup, investor_portfolio)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline execution failed: {e}")

    return result


# ─── Serve frontend static files ──────────────────────────────────────────────
_frontend_dir = Path(__file__).resolve().parent.parent / "frontend"
if _frontend_dir.is_dir():
    app.mount("/", StaticFiles(directory=str(_frontend_dir), html=True), name="frontend")

