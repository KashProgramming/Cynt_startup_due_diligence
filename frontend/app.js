/* ═══════════════════════════════════════════════════════════════════════════
   AI Startup Due Diligence Engine — Client-Side Application
   ═══════════════════════════════════════════════════════════════════════════ */

const API = ""; // same origin

// ─── State ───────────────────────────────────────────────────────────────────
const state = {
  files: { pitch_deck: null, financials: null, founder_profile: null },
  currentStep: 1,
  result: null,
};

// ─── DOM Refs ────────────────────────────────────────────────────────────────
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const panels = $$(".panel");
const stepBtns = $$(".step");
const stepLines = $$(".step__line");
const healthEl = $("#healthStatus");
const concSlider = $("#maxConcentration");
const concValue = $("#concValue");

// ─── Initialise ──────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  checkHealth();
  setupDropZones();
  setupNavigation();
  setupFormBindings();
  concSlider.addEventListener(
    "input",
    () => (concValue.textContent = concSlider.value),
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// HEALTH CHECK
// ═══════════════════════════════════════════════════════════════════════════════
async function checkHealth() {
  try {
    const res = await fetch(`${API}/health`);
    if (res.ok) {
      healthEl.className = "header__status online";
      healthEl.querySelector(".status-text").textContent = "API Online";
    } else throw new Error();
  } catch {
    healthEl.className = "header__status offline";
    healthEl.querySelector(".status-text").textContent = "API Offline";
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DRAG-AND-DROP FILE UPLOAD
// ═══════════════════════════════════════════════════════════════════════════════
function setupDropZones() {
  const zones = [
    {
      drop: "#drop-pitch",
      input: "#input-pitch",
      key: "pitch_deck",
      display: "#file-pitch",
    },
    {
      drop: "#drop-financials",
      input: "#input-financials",
      key: "financials",
      display: "#file-financials",
    },
    {
      drop: "#drop-founder",
      input: "#input-founder",
      key: "founder_profile",
      display: "#file-founder",
    },
  ];

  zones.forEach(({ drop, input, key, display }) => {
    const dropEl = $(drop);
    const inputEl = $(input);
    const displayEl = $(display);

    // Click to upload
    dropEl.addEventListener("click", () => inputEl.click());

    // File input change
    inputEl.addEventListener("change", () => {
      if (inputEl.files[0]) setFile(key, inputEl.files[0], dropEl, displayEl);
    });

    // Drag events
    ["dragenter", "dragover"].forEach((evt) =>
      dropEl.addEventListener(evt, (e) => {
        e.preventDefault();
        dropEl.classList.add("dragover");
      }),
    );
    ["dragleave", "drop"].forEach((evt) =>
      dropEl.addEventListener(evt, (e) => {
        e.preventDefault();
        dropEl.classList.remove("dragover");
      }),
    );
    dropEl.addEventListener("drop", (e) => {
      const file = e.dataTransfer.files[0];
      if (file) setFile(key, file, dropEl, displayEl);
    });
  });
}

function setFile(key, file, dropEl, displayEl) {
  state.files[key] = file;
  dropEl.classList.add("has-file");
  displayEl.textContent = `✓ ${file.name}`;
  validateStep1();
}

function validateStep1() {
  const allUploaded = Object.values(state.files).every(Boolean);
  $("#btnToStep2").disabled = !allUploaded;
  $("#btnPreview").disabled = !allUploaded;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════════
function setupNavigation() {
  $("#btnToStep2").addEventListener("click", () => goToStep(2));
  $("#btnBackTo1").addEventListener("click", () => goToStep(1));
  $("#btnAnalyze").addEventListener("click", runAnalysis);
  $("#btnNewAnalysis").addEventListener("click", resetAll);
  $("#btnPreview").addEventListener("click", previewProfile);
  $("#btnCloseModal").addEventListener("click", () =>
    $("#previewModal").classList.remove("active"),
  );
  $("#btnCopyMemo").addEventListener("click", copyMemo);

  // Close modal on overlay click
  $("#previewModal").addEventListener("click", (e) => {
    if (e.target === $("#previewModal"))
      $("#previewModal").classList.remove("active");
  });
}

function goToStep(num) {
  state.currentStep = num;

  // Update panels
  panels.forEach((p) => p.classList.remove("active"));
  $(`#panel-${num}`).classList.add("active");

  // Update step indicators
  stepBtns.forEach((btn, i) => {
    const step = i + 1;
    btn.classList.remove("active", "done");
    if (step === num) btn.classList.add("active");
    else if (step < num) btn.classList.add("done");
  });

  // Update step lines
  stepLines.forEach((line, i) => {
    line.classList.toggle("done", i + 1 < num);
  });
}

function resetAll() {
  state.files = { pitch_deck: null, financials: null, founder_profile: null };
  state.result = null;

  // Reset drop zones
  $$(".dropzone").forEach((z) => z.classList.remove("has-file"));
  $$(".dropzone__file").forEach((d) => (d.textContent = ""));
  $$('.dropzone input[type="file"]').forEach((i) => (i.value = ""));

  // Reset pipeline stages
  $$(".pstage").forEach((p) => {
    p.classList.remove("active", "done");
  });

  validateStep1();
  goToStep(1);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PORTFOLIO SERIALISATION
// ═══════════════════════════════════════════════════════════════════════════════
function buildPortfolioJSON() {
  const parse = (id) =>
    $(id)
      .value.split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  return JSON.stringify({
    investor_type: $("#investorType").value,
    portfolio_sectors: parse("#sectors"),
    portfolio_stages: parse("#stages"),
    portfolio_geographies: parse("#geographies"),
    check_size_range_usd: [
      parseFloat($("#checkMin").value),
      parseFloat($("#checkMax").value),
    ],
    total_investments: parseInt($("#totalInvestments").value, 10),
    target_max_sector_concentration_pct: parseFloat(
      $("#maxConcentration").value,
    ),
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORM BINDINGS
// ═══════════════════════════════════════════════════════════════════════════════
function setupFormBindings() {
  // Portfolio form should not navigate away
  $("#portfolioForm").addEventListener("submit", (e) => e.preventDefault());
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXTRACT PROFILE (PREVIEW)
// ═══════════════════════════════════════════════════════════════════════════════
async function previewProfile() {
  const modal = $("#previewModal");
  const body = $("#previewBody");
  modal.classList.add("active");
  body.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;padding:2rem 0;">
      <div class="analyzing__spinner analyzing__spinner--small">
        <div class="orbit"><div class="orbit__dot"></div></div>
        <div class="analyzing__core"></div>
      </div>
      <p style="margin-top:1rem;color:var(--text-muted);">Extracting startup profile…</p>
    </div>`;

  const fd = new FormData();
  fd.append("pitch_deck", state.files.pitch_deck);
  fd.append("financials", state.files.financials);
  fd.append("founder_profile", state.files.founder_profile);

  try {
    const res = await fetch(`${API}/extract-profile`, {
      method: "POST",
      body: fd,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    const profile = await res.json();
    renderProfilePreview(profile, body);
  } catch (e) {
    body.innerHTML = `<p style="color:var(--accent-red);text-align:center;">❌ ${e.message}</p>`;
    showToast(e.message, "error");
  }
}

function renderProfilePreview(p, container) {
  const field = (label, value) =>
    `<div class="profile-field"><span>${label}</span><span>${value}</span></div>`;

  container.innerHTML = `
    ${field("Company", p.company_name)}
    ${field("Sector", p.sector)}
    ${field("Stage", p.stage)}
    ${field("Geography", p.geography)}
    ${field("TAM", "$" + fmtNum(p.tam_usd_millions) + "M")}
    ${field("Growth Rate", p.growth_rate_pct + "% YoY")}
    ${field("Revenue (ARR)", "$" + fmtNum(p.revenue_usd))}
    ${field("Monthly Burn", "$" + fmtNum(p.burn_rate_usd_monthly))}
    ${field("Raise Amount", "$" + fmtNum(p.raise_amount_usd))}
    ${field("Pre-Money Val", "$" + fmtNum(p.pre_money_valuation_usd))}
    ${field("Existing Cash", "$" + fmtNum(p.existing_cash_usd))}
    ${field("Founder", p.founder_name)}
    ${field("Prior Exits", p.prior_exits)}
    ${field("Domain Exp", p.domain_years_experience + " years")}
    ${field("Competitors", (p.competitors || []).join(", ") || "—")}
    ${field("Advantages", (p.competitive_advantages || []).join(", ") || "—")}
    ${field("Advisors", (p.notable_investors_or_advisors || []).join(", ") || "—")}
  `;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RUN FULL ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════════
async function runAnalysis() {
  goToStep(3);

  // Start pipeline stage animation
  const stages = [
    "ps-extract",
    "ps-financial",
    "ps-market",
    "ps-agents",
    "ps-decision",
    "ps-memo",
  ];
  const stageMessages = [
    "Extracting startup profile from documents…",
    "Running financial simulation…",
    "Fetching external market signals…",
    "Running AI agent analysis…",
    "Computing investment decision…",
    "Generating investment memo…",
  ];
  let stageIdx = 0;

  // Animate stages in sequence
  const stageInterval = setInterval(() => {
    if (stageIdx > 0) {
      $(`#${stages[stageIdx - 1]}`).classList.remove("active");
      $(`#${stages[stageIdx - 1]}`).classList.add("done");
    }
    if (stageIdx < stages.length) {
      $(`#${stages[stageIdx]}`).classList.add("active");
      $("#analyzeStatus").textContent = stageMessages[stageIdx];
      stageIdx++;
    } else {
      clearInterval(stageInterval);
    }
  }, 3000);

  // Build FormData
  const fd = new FormData();
  fd.append("pitch_deck", state.files.pitch_deck);
  fd.append("financials", state.files.financials);
  fd.append("founder_profile", state.files.founder_profile);
  fd.append("portfolio", buildPortfolioJSON());

  try {
    const res = await fetch(`${API}/analyze`, { method: "POST", body: fd });
    clearInterval(stageInterval);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }

    state.result = await res.json();

    // Complete all stages
    stages.forEach((s) => {
      $(`#${s}`).classList.remove("active");
      $(`#${s}`).classList.add("done");
    });
    $("#analyzeStatus").textContent = "Analysis complete!";

    // Brief delay for visual effect, then show results
    await delay(800);
    renderResults(state.result);
    goToStep(4);
    showToast("Due diligence analysis complete!", "success");
  } catch (e) {
    clearInterval(stageInterval);
    showToast(`Analysis failed: ${e.message}`, "error");
    goToStep(2);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// RENDER RESULTS
// ═══════════════════════════════════════════════════════════════════════════════
function renderResults(r) {
  renderHero(r);
  renderScoreCards(r);
  renderSimulation(r.financial_simulation, r.financial_risk);
  renderSignals(r.market_signals);
  renderRisksMilestones(r.investment_decision);
  renderMemo(r.memo);
}

// ─── Hero ────────────────────────────────────────────────────────────────────
function renderHero(r) {
  const d = r.investment_decision;
  const s = r.startup;

  // Decision badge
  const badge = $("#decisionBadge");
  badge.textContent = d.final_decision.replace(/_/g, " ");
  badge.className = "decision-badge";
  if (d.final_decision === "INVEST") badge.classList.add("invest");
  else if (d.final_decision === "INVEST_WITH_CONDITIONS")
    badge.classList.add("conditions");
  else if (d.final_decision === "WATCHLIST") badge.classList.add("watchlist");
  else badge.classList.add("pass");

  // Check size tier
  $("#heroCheck").textContent =
    `Check Size Tier: ${d.suggested_check_size_tier}`;

  // Gauge
  const pct = d.decision_score / 100;
  const circumference = 2 * Math.PI * 52;
  const offset = circumference * (1 - pct);
  const circle = $("#gaugeCircle");
  circle.style.strokeDasharray = circumference;

  requestAnimationFrame(() => {
    setTimeout(() => {
      circle.style.strokeDashoffset = offset;
    }, 100);
  });
  animateCounter("#gaugeValue", d.decision_score);

  // Info
  $("#heroCompany").textContent = s.company_name;
  $("#heroSector").textContent = s.sector;
  $("#heroStage").textContent = s.stage;
  $("#heroRaise").textContent = "$" + fmtNum(s.raise_amount_usd);
  $("#heroVal").textContent = "$" + fmtNum(s.pre_money_valuation_usd);
}

// ─── Score Cards ─────────────────────────────────────────────────────────────
function renderScoreCards(r) {
  // Financial Risk
  setMiniGauge("#mg-financial", r.financial_risk.sustainability_score);
  $("#det-financial").innerHTML = `
    <div class="detail-row"><span>Bankruptcy Timeline</span><span>${r.financial_risk.bankruptcy_timeline_months} mo</span></div>
    <div class="detail-row"><span>Capital Efficiency</span><span>${r.financial_risk.capital_efficiency_ratio}</span></div>
    <div class="detail-row"><span>Valuation Flag</span><span class="${r.financial_risk.valuation_realism_flag ? "flag" : "ok"}">${r.financial_risk.valuation_realism_flag ? "⚠ Flagged" : "✓ OK"}</span></div>
    ${(r.financial_risk.key_financial_risks || []).map((rsk) => `<div class="risk-tag">${rsk}</div>`).join("")}
  `;

  // Market Validation
  setMiniGauge("#mg-market", r.market_validation.market_momentum_score);
  $("#det-market").innerHTML = `
    <div class="detail-row"><span>Hype vs Evidence</span><span>${r.market_validation.hype_vs_evidence_delta}</span></div>
    <div class="detail-row"><span>Competitive Saturation</span><span>${r.market_validation.competitive_saturation_score}/100</span></div>
    ${(r.market_validation.key_market_risks || []).map((rsk) => `<div class="risk-tag">${rsk}</div>`).join("")}
  `;

  // Founder Intelligence
  setMiniGauge(
    "#mg-founder",
    r.founder_intelligence.founder_intelligence_score,
  );
  $("#det-founder").innerHTML = `
    <div class="detail-row"><span>Domain Fit</span><span>${r.founder_intelligence.domain_fit_score}/100</span></div>
    <div class="detail-row"><span>Network Strength</span><span>${r.founder_intelligence.network_strength_score}/100</span></div>
    <div class="detail-row"><span>Execution Credibility</span><span>${r.founder_intelligence.execution_credibility_score}/100</span></div>
    <div class="detail-row"><span>Risk Level</span><span class="${r.founder_intelligence.risk_level === "HIGH" ? "flag" : "ok"}">${r.founder_intelligence.risk_level}</span></div>
    ${(r.founder_intelligence.key_founder_risks || []).map((rsk) => `<div class="risk-tag">${rsk}</div>`).join("")}
  `;

  // Portfolio Fit
  setMiniGauge("#mg-portfolio", r.portfolio_fit.portfolio_fit_score);
  $("#det-portfolio").innerHTML = `
    <div class="detail-row"><span>Overexposure Flag</span><span class="${r.portfolio_fit.overexposure_flag ? "flag" : "ok"}">${r.portfolio_fit.overexposure_flag ? "⚠ Yes" : "✓ No"}</span></div>
  `;
}

function setMiniGauge(sel, score) {
  const el = $(sel);
  el.querySelector("span").textContent = score;
  const pct = Math.min(score, 100);

  // Determine color based on score
  let color1, color2;
  if (pct >= 70) {
    color1 = "#06d6a0";
    color2 = "#10b981";
  } else if (pct >= 40) {
    color1 = "#f59e0b";
    color2 = "#f97316";
  } else {
    color1 = "#ef4444";
    color2 = "#dc2626";
  }

  requestAnimationFrame(() => {
    setTimeout(() => {
      el.style.background = `conic-gradient(${color1} 0%, ${color2} ${pct}%, rgba(255,255,255,0.06) ${pct}% 100%)`;
    }, 200);
  });
}

// ─── Financial Simulation ────────────────────────────────────────────────────
function renderSimulation(sim, risk) {
  const metrics = [
    { label: "Runway", value: `${sim.runway_months} mo`, icon: "⏱" },
    { label: "Burn Multiple", value: `${sim.burn_multiple}x`, icon: "🔥" },
    { label: "Dilution", value: `${sim.dilution_pct}%`, icon: "📊" },
    {
      label: "Bankruptcy",
      value: `${sim.bankruptcy_projection_months} mo`,
      icon: "⚠️",
    },
    {
      label: "Capital Efficiency",
      value: sim.capital_efficiency_ratio,
      icon: "💰",
    },
  ];

  $("#simMetrics").innerHTML = metrics
    .map(
      (m) => `
    <div class="sim-metric">
      <div class="sim-metric__value">${m.value}</div>
      <div class="sim-metric__label">${m.icon} ${m.label}</div>
    </div>
  `,
    )
    .join("");
}

// ─── Market Signals ──────────────────────────────────────────────────────────
function renderSignals(signals) {
  const bars = [
    { label: "Google Trends", value: signals.google_trends_score },
    { label: "News Frequency", value: signals.news_frequency_score },
    { label: "GitHub Activity", value: signals.github_activity_score },
    { label: "Composite Signal", value: signals.composite_signal_score },
  ];

  $("#signalBars").innerHTML = bars
    .map(
      (b) => `
    <div class="signal-bar">
      <div class="signal-bar__header"><span>${b.label}</span><span>${b.value}/100</span></div>
      <div class="signal-bar__track"><div class="signal-bar__fill" style="width:0%" data-target="${b.value}"></div></div>
    </div>
  `,
    )
    .join("");

  // Animate after render
  requestAnimationFrame(() => {
    setTimeout(() => {
      $$(".signal-bar__fill").forEach((fill) => {
        fill.style.width = fill.dataset.target + "%";
      });
    }, 200);
  });
}

// ─── Risks & Milestones ─────────────────────────────────────────────────────
function renderRisksMilestones(decision) {
  $("#riskList").innerHTML =
    (decision.key_risks || []).map((r) => `<li>${r}</li>`).join("") ||
    "<li>No risks identified</li>";

  $("#milestoneList").innerHTML =
    (decision.required_milestones || []).map((m) => `<li>${m}</li>`).join("") ||
    "<li>No milestones specified</li>";
}

// ─── Memo ────────────────────────────────────────────────────────────────────
function renderMemo(memo) {
  $("#memoBlock").textContent = memo;
}

function copyMemo() {
  const memo = $("#memoBlock").textContent;
  navigator.clipboard.writeText(memo).then(
    () => showToast("Memo copied to clipboard!", "success"),
    () => showToast("Failed to copy memo", "error"),
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════
function fmtNum(n) {
  if (n == null) return "—";
  return Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function animateCounter(sel, target) {
  const el = $(sel);
  let current = 0;
  const step = Math.max(1, Math.ceil(target / 40));
  const timer = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = Math.round(current);
    if (current >= target) clearInterval(timer);
  }, 30);
}

function showToast(message, type = "info") {
  const container = $("#toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${type === "error" ? "❌" : type === "success" ? "✅" : "ℹ️"}</span>
    <span>${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = "toastOut 0.4s var(--ease) forwards";
    setTimeout(() => toast.remove(), 400);
  }, 4500);
}
