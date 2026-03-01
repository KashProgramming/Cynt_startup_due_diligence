import React, { useRef } from "react";
import html2pdf from "html2pdf.js";
import {
    Download, RefreshCw, FileText, CheckCircle, AlertTriangle,
    TrendingUp, Activity, Shield, Target, Users, BarChart3, Zap
} from "lucide-react";

export default function Step4_Results({ result, onReset }) {
    const memoRef = useRef(null);

    const downloadPDF = () => {
        const element = memoRef.current;
        if (!element) return;
        html2pdf().set({
            margin: 0.5,
            filename: `Investment_Memo_${result.startup.company_name.replace(/\s+/g, '_')}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
        }).from(element).save();
    };

    const d = result.investment_decision;
    const s = result.startup;
    const sim = result.financial_simulation;
    const fr = result.financial_risk;
    const mv = result.market_validation;
    const fi = result.founder_intelligence;

    const fmtNum = (n) => n === null || n === undefined ? "—" : Number(n).toLocaleString('en-US');
    const fmtFallback = (val, suffix = "") => {
        if (val === null || val === undefined) return "N/A";
        if (typeof val === 'string' && val.includes("N/A")) return "N/A";
        return `${val}${suffix}`;
    };

    // Decision badge
    let badgeClass = "badge--yellow";
    let decisionLabel = d.final_decision.replace(/_/g, " ");
    if (d.final_decision === "INVEST") badgeClass = "badge--green";
    else if (d.final_decision === "PASS" || d.final_decision === "REJECT") badgeClass = "badge--red";

    // Score color
    const scoreColor = d.decision_score >= 70 ? "var(--olive)" : d.decision_score >= 40 ? "var(--gold)" : "var(--terracotta)";

    return (
        <div className="animate-fadeUp">
            {/* Hero Decision Card */}
            <div className="card" style={{
                marginBottom: "2rem", padding: "2.5rem",
                textAlign: "center", position: "relative",
                overflow: "hidden"
            }}>
                {/* Decorative corner shapes */}
                <div style={{
                    position: "absolute", top: -20, right: -20,
                    width: 80, height: 80, borderRadius: "50%",
                    background: `${scoreColor}15`, pointerEvents: "none"
                }} />
                <div style={{
                    position: "absolute", bottom: -30, left: -30,
                    width: 100, height: 100, borderRadius: "50%",
                    background: "var(--bg-elevated)", pointerEvents: "none"
                }} />

                {/* Decision Badge */}
                <div style={{ marginBottom: "1.5rem" }}>
                    <span className={`badge ${badgeClass}`} style={{
                        fontSize: "0.85rem", padding: "0.4rem 1.25rem",
                        letterSpacing: "0.08em"
                    }}>
                        {decisionLabel}
                    </span>
                </div>

                {/* Score Gauge */}
                <div style={{ position: "relative", width: 150, height: 150, margin: "0 auto 1.5rem" }}>
                    <svg viewBox="0 0 150 150" style={{ transform: "rotate(-90deg)" }}>
                        <circle cx="75" cy="75" r="62" fill="none" stroke="var(--light-border)" strokeWidth="8" />
                        <circle cx="75" cy="75" r="62" fill="none"
                            stroke={scoreColor} strokeWidth="8"
                            strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 62}`}
                            strokeDashoffset={`${2 * Math.PI * 62 * (1 - d.decision_score / 100)}`}
                            style={{ transition: "stroke-dashoffset 1.5s var(--ease-out)" }}
                        />
                    </svg>
                    <div style={{
                        position: "absolute", top: "50%", left: "50%",
                        transform: "translate(-50%, -50%)", textAlign: "center"
                    }}>
                        <div style={{
                            fontSize: "2.8rem", fontWeight: 700,
                            fontFamily: "var(--font-display)",
                            color: scoreColor, lineHeight: 1
                        }}>
                            {d.decision_score}
                        </div>
                        <div style={{
                            fontSize: "0.65rem", fontWeight: 700,
                            textTransform: "uppercase", letterSpacing: "0.1em",
                            color: "var(--warm-gray)", marginTop: "0.2rem"
                        }}>Score</div>
                    </div>
                </div>

                {/* Company Info Row */}
                <div style={{
                    display: "flex", justifyContent: "center", gap: "2rem",
                    flexWrap: "wrap"
                }}>
                    {[
                        { label: "Company", value: s.company_name },
                        { label: "Sector", value: `${s.sector} • ${s.stage}` },
                        { label: "Raise", value: `$${fmtNum(s.raise_amount_usd)}` },
                        { label: "Check Size", value: d.suggested_check_size_tier },
                    ].map((item) => (
                        <div key={item.label} style={{ textAlign: "center" }}>
                            <div style={{
                                fontSize: "0.65rem", fontWeight: 700,
                                textTransform: "uppercase", letterSpacing: "0.1em",
                                color: "var(--warm-gray)", marginBottom: "0.2rem"
                            }}>{item.label}</div>
                            <div style={{
                                fontSize: "1rem", fontWeight: 600,
                                color: "var(--charcoal)"
                            }}>{item.value}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Metrics Grid */}
            <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr",
                gap: "1.5rem", marginBottom: "1.5rem"
            }}>
                {/* Financial Card */}
                <div className="card" style={{ padding: "1.75rem" }}>
                    <div style={{
                        display: "flex", alignItems: "center", gap: "0.6rem",
                        marginBottom: "1.25rem", paddingBottom: "0.75rem",
                        borderBottom: "1px solid var(--light-border)"
                    }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: "var(--radius-sm)",
                            background: "var(--terracotta-light)", display: "flex",
                            alignItems: "center", justifyContent: "center"
                        }}>
                            <BarChart3 size={16} color="var(--terracotta)" />
                        </div>
                        <h3 style={{ fontSize: "1.1rem" }}>Financial Profile</h3>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                        <MetricRow label="Runway" value={fmtFallback(sim.runway_months, " mo")} />
                        <MetricRow label="Burn Multiple" value={fmtFallback(sim.burn_multiple, "x")} />
                        <MetricRow label="Bankruptcy Proj." value={fmtFallback(sim.bankruptcy_projection_months, " mo")} />
                        <MetricRow label="Capital Efficiency" value={sim.capital_efficiency_ratio} />
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ color: "var(--warm-gray)", fontSize: "0.9rem" }}>Valuation Flag</span>
                            <span className={`badge ${fr.valuation_realism_flag ? "badge--red" : "badge--green"}`}>
                                {fr.valuation_realism_flag ? "⚠ Flagged" : "✓ OK"}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Market & Founder Card */}
                <div className="card" style={{ padding: "1.75rem" }}>
                    <div style={{
                        display: "flex", alignItems: "center", gap: "0.6rem",
                        marginBottom: "1.25rem", paddingBottom: "0.75rem",
                        borderBottom: "1px solid var(--light-border)"
                    }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: "var(--radius-sm)",
                            background: "var(--olive-light)", display: "flex",
                            alignItems: "center", justifyContent: "center"
                        }}>
                            <Target size={16} color="var(--olive)" />
                        </div>
                        <h3 style={{ fontSize: "1.1rem" }}>Market & Founder</h3>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                        <MetricRow label="Market Momentum" value={`${mv.market_momentum_score}/100`} />
                        <MetricRow label="Hype vs Evidence" value={mv.hype_vs_evidence_delta} />
                        <MetricRow label="Competitive Saturation" value={`${mv.competitive_saturation_score}/100`} />
                        <div style={{
                            display: "flex", justifyContent: "space-between",
                            alignItems: "center", marginTop: "0.5rem",
                            paddingTop: "0.5rem", borderTop: "1px solid var(--light-border)"
                        }}>
                            <span style={{ color: "var(--warm-gray)", fontSize: "0.9rem" }}>Founder Risk</span>
                            <span className={`badge ${fi.risk_level === "HIGH" ? "badge--red" : fi.risk_level === "MEDIUM" ? "badge--yellow" : "badge--green"}`}>
                                {fi.risk_level}
                            </span>
                        </div>
                        <MetricRow label="Domain Fit" value={`${fi.domain_fit_score}/100`} />
                    </div>
                </div>
            </div>

            {/* Risks & Milestones */}
            <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr",
                gap: "1.5rem", marginBottom: "2rem"
            }}>
                <div className="card" style={{ padding: "1.75rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem" }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: "var(--radius-sm)",
                            background: "var(--danger-bg)", display: "flex",
                            alignItems: "center", justifyContent: "center"
                        }}>
                            <AlertTriangle size={16} color="var(--terracotta)" />
                        </div>
                        <h3 style={{ fontSize: "1.1rem" }}>Key Risks</h3>
                    </div>
                    <ul style={{
                        paddingLeft: "1.25rem", display: "flex",
                        flexDirection: "column", gap: "0.4rem"
                    }}>
                        {d.key_risks?.length
                            ? d.key_risks.map((r, i) => (
                                <li key={i} style={{ color: "var(--warm-gray)", fontSize: "0.9rem" }}>{r}</li>
                            ))
                            : <li style={{ color: "var(--warm-gray)", fontSize: "0.9rem" }}>No major risks identified.</li>
                        }
                    </ul>
                </div>

                <div className="card" style={{ padding: "1.75rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem" }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: "var(--radius-sm)",
                            background: "var(--success-bg)", display: "flex",
                            alignItems: "center", justifyContent: "center"
                        }}>
                            <CheckCircle size={16} color="var(--olive)" />
                        </div>
                        <h3 style={{ fontSize: "1.1rem" }}>Required Milestones</h3>
                    </div>
                    <ul style={{
                        paddingLeft: "1.25rem", display: "flex",
                        flexDirection: "column", gap: "0.4rem"
                    }}>
                        {d.required_milestones?.length
                            ? d.required_milestones.map((m, i) => (
                                <li key={i} style={{ color: "var(--warm-gray)", fontSize: "0.9rem" }}>{m}</li>
                            ))
                            : <li style={{ color: "var(--warm-gray)", fontSize: "0.9rem" }}>No specific milestones.</li>
                        }
                    </ul>
                </div>
            </div>

            {/* Investment Memo */}
            <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: "2.5rem" }}>
                <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "1.25rem 1.75rem",
                    background: "var(--bg-elevated)",
                    borderBottom: "1px solid var(--light-border)"
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                        <FileText size={20} color="var(--charcoal)" />
                        <h3 style={{ fontSize: "1.2rem" }}>Investment Memo</h3>
                    </div>
                    <button className="btn btn--accent" onClick={downloadPDF} style={{ padding: "0.5rem 1.25rem", fontSize: "0.85rem" }}>
                        <Download size={15} /> Download PDF
                    </button>
                </div>
                <div style={{ padding: "1.75rem" }}>
                    <div ref={memoRef} style={{
                        background: "var(--bg-input)", padding: "1.5rem",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--light-border)"
                    }}>
                        <pre style={{
                            whiteSpace: "pre-wrap",
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: "0.9rem",
                            color: "var(--charcoal)",
                            lineHeight: 1.75
                        }}>
                            {result.memo}
                        </pre>
                    </div>
                </div>
            </div>

            {/* Reset */}
            <div style={{ display: "flex", justifyContent: "center" }}>
                <button className="btn" onClick={onReset} style={{
                    padding: "0.85rem 2.5rem", fontSize: "1rem"
                }}>
                    <RefreshCw size={18} /> Start New Analysis
                </button>
            </div>
        </div>
    );
}

function MetricRow({ label, value }) {
    return (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "var(--warm-gray)", fontSize: "0.9rem" }}>{label}</span>
            <strong style={{ fontSize: "0.95rem", fontFamily: "var(--font-body)", color: "var(--charcoal)" }}>{value}</strong>
        </div>
    );
}
