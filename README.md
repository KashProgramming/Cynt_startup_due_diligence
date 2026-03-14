# Cynt — AI-Powered Startup Due Diligence System

> **Cynt** is a full-stack platform that automates startup investment due diligence using a multi-agent AI pipeline. Entrepreneurs submit their documents; investors receive structured analysis, scores, and a go/no-go recommendation — all in minutes.

---

## Overview

Cynt is a **B2B investment intelligence platform** that connects entrepreneurs and investors. The core value proposition is a **4-stage async AI pipeline** that:

1. Extracts structured data from raw documents (PDFs, CSVs/XLSX).
2. Runs deterministic financial and market simulations.
3. Scores the startup across three dimensions using LLM-powered agents.
4. Synthesises a final investment recommendation and a plain-text investment memo.

**Two user roles** exist:
- **Entrepreneurs** — upload pitch deck, financials, and founder profile, select and apply to investors, receive emails for decisions.
- **Investors** — review applications, trigger AI analysis, accept/reject startups, and invite other investors to collaborate.

---

## Technology Stack
Backend: Python, FastAPI
Frontend: React (Vite)
Database: MongoDB
LLM: Groq via LangChain
Containerization: Docker
External APIs: Google Trends, NewsAPI, LinkedIn (RapidAPI)

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Browser / Client                           │
│                        React 19 + Vite SPA                          │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ HTTP (REST, FormData)
┌───────────────────────────────▼─────────────────────────────────────┐
│                      FastAPI Gateway (api/gateway.py)               │
│  Auth  │  Applications  │  Collaborations  │  Invites  │  Legacy    │
└──┬─────────────┬──────────────────────────────────────────────────┬─┘
   │             │                                                  │
   ▼             ▼                                                  ▼
MongoDB     AI Pipeline                                       Static files
(PyMongo)   (core/pipeline.py)                             (frontend/dist)
               │
   ┌───────────┼────────────────────────────┐
   ▼           ▼           ▼                ▼
Stage 1:   Stage 1b:   Stage 2:         Stage 3:
Financial  LinkedIn    Three agents     Investment
Simulation enrichment  in parallel      Decision
+Market               (Financial Risk,  Engine
Signals               Market Validation,(Meta-Agent)
                      Founder Intel.)
                                         │
                                         ▼
                                     Stage 4:
                                     Memo Generator
                                     (Jinja2)
```
---

## Project Structure

```
cynt_due_diligence/
│
├── main.py                          # Entry point — starts Uvicorn
├── requirements.txt                 # Python dependencies
├── Dockerfile                       # Multi-stage Docker build
├── sample_portfolio.json            # Example InvestorPortfolio JSON
│
├── api/
│   └── gateway.py                   # FastAPI app — all endpoints (~966 lines)
│
├── core/
│   ├── pipeline.py                  # Async 4-stage orchestrator
│   ├── document_processor.py        # PDF/CSV extraction + LLM field extraction
│   ├── financial_simulation.py      # Deterministic financial metrics
│   ├── market_signals.py            # Google Trends + News API signals
│   └── memo_generator.py            # Jinja2 investment memo
│
├── agents/
│   ├── financial_risk_agent.py      # LLM agent: financial health scoring
│   ├── market_validation_agent.py   # LLM agent: market momentum + saturation
│   ├── founder_intelligence_agent.py# LLM agent: domain fit, network, execution
│   ├── investment_decision_engine.py# Meta-agent: weighted decision score
│   └── founder_intelligence_agent_real.py  # (alternate/legacy variant)
│
├── utils/
│   ├── models.py                    # All Pydantic data models
│   ├── llm.py                       # ChatGroq init + JSON extraction helper
│   ├── db.py                        # MongoDB lazy singleton + collection accessors
│   ├── email_sender.py              # SMTP email notifications (approved/rejected)
│   ├── linkedin_fetcher.py          # MongoDB-backed LinkedIn profile lookup
│   ├── linkedin_scraper.py          # RapidAPI live LinkedIn scraper + mapper
│   ├── linkedin_scrappper.py        # scrape_and_store_linkedin: triggers scrape + store
│   ├── scraper.py                   # (helper scraper utility)
│   ├── seed_db.py                   # Seed script (legacy)
│   └── seed_users.py                # Seed 4 sample investor accounts to MongoDB
│
├── frontend/
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── src/
│       ├── main.jsx                 # React DOM render
│       ├── App.jsx                  # Role-based routing (Login/Entrepreneur/Investor)
│       ├── api.js                   # Typed API client (all fetch calls)
│       ├── index.css                # Global design system + component styles
│       └── components/
│           ├── LoginPage.jsx        # Login + registration modal
│           ├── EntrepreneurDashboard.jsx   # Entrepreneur view
│           ├── InvestorDashboard.jsx       # Investor view (largest component)
│           ├── WizardLayout.jsx     # Multi-step wizard container
│           ├── Step1_Upload.jsx     # Upload files step
│           ├── Step2_Config.jsx     # Investor portfolio config step
│           ├── Step3_Analyzing.jsx  # Loading / analysis-in-progress step
│           └── Step4_Results.jsx    # Full results display step
│
└── data/                            # (data directory, used by scraper)
```

---

## Core Modules

### Document Processor
Extracts a structured `StartupProfile` from three uploaded documents:
| Input | Format | How processed |
|---|---|---|
| Pitch deck | PDF | `pypdf.PdfReader` — text extracted per page |
| Financials | CSV or XLSX | `pandas.read_csv` / `read_excel` |
| Founder profile | PDF | `pypdf.PdfReader` |

**Two-phase extraction:**
1. **Deterministic CSV parse** (`parse_financial_csv`): looks for standard metric rows (`Annual Revenue`, `Monthly Burn Rate`, `Existing Cash on Hand`, `Target Raise Amount`, `Pre-Money Valuation`, `Annual Growth Rate`, `TAM`) in a `Metric, Current, Projected` CSV format. These values **always override** LLM estimates for financial fields.
2. **LLM extraction** (`ChatGroq llama-3.3-70b-versatile`): given the first 6000 chars of pitch deck + 3000 chars each of financials and founder profile, extracts a JSON object with ~19 fields covering company basics, market claims, financials, and founder info.
3. **LinkedIn enrichment**: if a LinkedIn URL (`linkedin.com/in/...`) is found in founder text or pitch deck, `linkedin_fetcher.fetch_linkedin_profile()` is called first (MongoDB cache), then attaches `LinkedInProfile` to the `StartupProfile`.

---

### Financial Simulation Engine
Fully **deterministic** (no LLM). Takes a `StartupProfile` and computes:
| Metric | Formula |
|---|---|
| `runway_months` | `(existing_cash + raise_amount) / net_monthly_burn` |
| `burn_multiple` | `annual_burn / net_new_ARR` (burn per $1 of new ARR grown) |
| `dilution_pct` | `raise_amount / (pre_money_val + raise_amount) × 100` |
| `bankruptcy_projection_months` | `existing_cash / net_monthly_burn` (without the new raise) |
| `capital_efficiency_ratio` | `revenue / total_capital` |
Where `net_burn = max(monthly_burn - monthly_revenue, 0)`.

---

### Market Signal Connector
Fetches external market signals and normalises them to 0–100:
| Signal | Source | Caching |
|---|---|---|
| `google_trends_score` | `pytrends` — 12-month interest for sector keyword | `@lru_cache(128)` |
| `news_frequency_score` | News API — total article count (log-normalised, cap 100) | `@lru_cache(128)` |
| `composite_signal_score` | `0.5 × trends + 0.5 × news` | derived |
Falls back to `50.0` for any signal if API key is missing or call fails.

---

### Memo Generator
Renders a plain-text **investment memo** using Jinja2 from the complete `DueDiligenceResult`. Fully deterministic — no LLM. The template covers:
- Company header (name, sector, stage, geography, founder, raise, valuation)
- Final recommendation + decision score + check size tier
- Score dashboard (4 scores)
- Financial analysis (runway, burn multiple, dilution, bankruptcy, capital efficiency, valuation flag, key risks)
- Market validation (TAM, growth %, external signals, key risks)
- Founder assessment (all sub-scores, risk level, key risks)
- Aggregate key risks
- Required milestones

---

## AI Agents
All agents use `langchain_groq.ChatGroq` with `temperature=0` (deterministic), `llama-3.3-70b-versatile`. They receive a structured system prompt + a tightly-formatted human message and return a **JSON object only**.
There are three specialized AI agents:
- Financial Risk Agent – evaluates burn rate, runway, and valuation realism.
- Market Validation Agent – analyzes market demand signals and competitive saturation.
- Founder Intelligence Agent – evaluates founder experience, network strength, and execution credibility.
A final meta-agent combines the results to produce a deterministic investment recommendation.

---

## Frontend
Built with **React 19 + Vite 7**. Single-page app served from FastAPI's static file mount in production.

### App Routing (`App.jsx`)
```
App
├── (no user)  → LoginPage
├── (entrepreneur) → EntrepreneurDashboard
└── (investor) → InvestorDashboard
```

Role is set from the login API response and stored in React state.

API base URL auto-detects environment: Vite dev server (port 5170–5180) → `localhost:8000`; production → `window.location.origin`.

---

### Entrepreneur Flow
**`EntrepreneurDashboard.jsx`:**
- Shows a list of all submitted applications (company name, target investor, status badge, date).
- **"Apply to Investor"** button → opens a multi-step wizard:
  1. **Step1_Upload** — upload pitch deck (PDF), financials (CSV/XLSX), founder profile (PDF), enter company name and LinkedIn URL, select target investor(s).
  2. **Step2_Config** — (legacy wizard step for portfolio config).
  3. **Step3_Analyzing** — animated progress screen during pipeline execution.
  4. **Step4_Results** — displays the full `DueDiligenceResult`: score dashboard (cards + Recharts bar chart), financial simulation table, market signals, founder assessment, investment decision, and the raw text memo. Includes **PDF export** via `html2pdf.js`.
- Application statuses displayed: `Pending`, `Analyzed`, `Accepted`, `Rejected`.

### Investor Flow
**Tabs:**
1. **Applications** — all incoming applications (direct + collab-invited). For each:
   - View documents, trigger AI analysis, view results, send collaboration invite to another investor.
   - Accept or reject with optional message.
   - Deal summary showing all investors and collaborators on a startup.
2. **Invites** — all pending collaboration invites received. Can assess (run AI pipeline) and then accept/reject.
3. **Collaboration Hub** — decided invites (accepted + rejected) for both sent and received. Shows who invited whom and the final outcome.

---

## Data Flow: End-to-End
```
Entrepreneur uploads documents
         │
         ▼
Documents stored in MongoDB
         │
         ▼
Investor triggers analysis
         │
         ▼
AI pipeline processes documents
         │
         ▼
Financial + market analysis
         │
         ▼
AI agents evaluate startup
         │
         ▼
Decision score + investment memo generated
         │
         ▼
Investor accepts or rejects
```

---

## Environment Variables
Create a `.env` file in the project root:
```env
# LLM
GROQ_API_KEY=your_groq_api_key
# MongoDB
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true
DB_NAME=data                              # For LinkedIn indicator collection
COLLECTION_NAME=indicator                 # For LinkedIn indicator collection
# Market signals
NEWS_API_KEY=your_newsapi_key             # newsapi.org
# LinkedIn (optional — activates live scraping)
RAPIDAPI_KEY=your_rapidapi_key
RAPIDAPI_HOST=fresh-linkedin-scraper-api.p.rapidapi.com
# Email notifications (optional)
SMTP_EMAIL=your_gmail@gmail.com
SMTP_PASSWORD=your_gmail_app_password
SMTP_HOST=smtp.gmail.com                  # default
SMTP_PORT=587                             # default
# Server (set by Docker/HF Spaces)
PORT=7860                                 # defaults to 8000 locally
```
**Minimum required**: `GROQ_API_KEY` + `MONGO_URI`
**Optional services** (system degrades gracefully):
- `NEWS_API_KEY` — market signals fall back to 50.0 neutral score
- `RAPIDAPI_KEY` — LinkedIn live scrape skipped (falls back to document text)
- `SMTP_EMAIL` + `SMTP_PASSWORD` — email notifications skipped silently

---

## Running Locally
### Backend
```bash
# Install Python dependencies
pip install -r requirements.txt
# Copy and fill in environment variables
cp .env.example .env  # or create .env manually
# Run the FastAPI server (with auto-reload in local mode)
python main.py
# → http://localhost:8000
# → API docs at http://localhost:8000/docs
```

### Frontend (Dev Server)
```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

In dev mode, `api.js` automatically proxies to `http://localhost:8000`.

---

## Docker / Deployment
### Multi-Stage Build
The Dockerfile uses a two-stage build:
**Stage 1 (Node 20 Alpine):** Installs frontend deps, runs `npm run build`, produces `frontend/dist`.
**Stage 2 (Python 3.11 slim):**
- Installs `gcc`, `libffi-dev` for native Python deps.
- Installs Python packages from `requirements.txt`.
- Copies Python source (`main.py`, `api/`, `agents/`, `core/`, `utils/`).
- Copies built frontend from Stage 1 into `frontend/dist`.
- Sets `PORT=7860` (HuggingFace Spaces convention).
- Runs `python main.py`.
FastAPI serves the React SPA by mounting the `frontend/dist` folder at `/`:
```python
app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="frontend")
```

### Build and Run
```bash
docker build -t cynt .
docker run -p 7860:7860 --env-file .env cynt
# → http://localhost:7860
```

---

## Contributing
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Commit your changes (`git commit -m 'Add feature'`)
4. Push to the branch (`git push origin feature/new-feature`)
5. Open a Pull Request
