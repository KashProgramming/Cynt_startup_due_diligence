# Cynt — AI-Powered Startup Due Diligence System

> **Cynt** is a full-stack platform that automates startup investment due diligence using a multi-agent AI pipeline. Entrepreneurs submit their documents; investors receive structured analysis, scores, and a go/no-go recommendation — all in minutes.

## Key Features

- Multi-agent AI pipeline for automated startup due diligence
- Document ingestion from pitch decks, financial spreadsheets, and founder profiles
- Deterministic financial simulations and market signal analysis
- AI-generated investment memo with structured risk analysis
- Collaboration workflow enabling multiple investors to evaluate the same startup
- Automated email notifications informing entrepreneurs when applications are **approved or rejected**, including the **investor decision and message**

## Technology Stack
| Layer | Technology |
|------|------------|
| Backend | Python, FastAPI |
| Frontend | React (Vite) |
| Database | MongoDB |
| LLM | Groq (LangChain) |
| Containerization | Docker |
| External APIs | Google Trends, NewsAPI, LinkedIn |

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

- **Document Processor**: Extracts structured startup data from pitch decks, financial spreadsheets, and founder profiles.
- **Financial Simulation Engine**: Computes financial health metrics such as runway, burn efficiency, dilution, and capital efficiency.
- **Market Signal Connector**: Fetches external market signals from Google Trends and news activity to estimate market momentum.
- **Memo Generator**: Produces a structured investment memo summarizing analysis results and risks.
- **Pipeline Orchestrator**: Coordinates the full asynchronous analysis pipeline and aggregates agent outputs.

---

## AI Agents
All agents use `langchain_groq.ChatGroq` with `temperature=0` (deterministic), `llama-3.3-70b-versatile`. They receive a structured system prompt + a tightly-formatted human message and return a **JSON object only**.
There are three specialized AI agents:
- Financial Risk Agent – evaluates burn rate, runway, and valuation realism.
- Market Validation Agent – analyzes market demand signals and competitive saturation.
- Founder Intelligence Agent – evaluates founder experience, network strength, and execution credibility.
A final decision engine aggregates the agent scores using deterministic weighting and generates the final investment recommendation.

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
#### Dashboard
Entrepreneurs can view and manage all of their submitted applications. The dashboard displays:
- Company name
- Target investor
- Application status
- Submission date

#### Apply to Investor
**Upload required files and startup details:**
- Pitch deck (PDF)
- Financials (CSV/XLSX)
- Founder profile (PDF)
- Company name
- Founder LinkedIn URL
- Target investor(s)

**Application Status**
Applications appear in the dashboard with one of the following statuses:
- `Pending`
- `Analyzed`
- `Accepted`
- `Rejected`

Entrepreneurs also receive **email notifications from Cynt** when investors approve or reject their application.

---

### Investor Flow
Investors review incoming startup applications and perform AI-powered due diligence.
The **Investor Dashboard** contains three primary tabs.

#### Applications
Displays all startups submitted directly to the investor as well as applications shared through collaboration.
For each application, investors can:
- View uploaded documents
- Trigger the **AI analysis pipeline**
- Review the full **analysis results**, including:
  - Score dashboard (visual cards + Recharts chart)
  - Financial simulation results
  - Market signal analysis
  - Founder assessment
  - Final investment decision
  - Generated investment memo

Results can also be exported as a **PDF report**.

Investors may then:
- **Accept** or **Reject** the startup (with an optional message to the entrepreneur)
- **Invite other investors** to collaborate on the evaluation
- View a **deal summary** showing all participating investors and collaboration activity.

#### Invites
Shows all **pending collaboration invites** received from other investors.
Invited investors must first **run their own AI assessment** before deciding whether to join the collaboration.
They can then:
- Accept the collaboration
- Reject the collaboration

#### Collaboration Hub
Displays all **decided collaboration invitations** (both sent and received), including:
- Accepted collaborations
- Rejected invitations
- Which investor invited whom
- The final collaboration outcome

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
