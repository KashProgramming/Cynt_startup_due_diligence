import React, { useState, useRef } from "react";
import html2pdf from "html2pdf.js";
import {
    Download, RefreshCw, FileText, CheckCircle, AlertTriangle,
    TrendingUp, Activity, Shield, Target, Users, BarChart3, Zap,
    Info, ChevronDown, ChevronUp
} from "lucide-react";
import {
    RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from "recharts";

// ─── Metric explanation data ────────────────────────────────────────────────

const FINANCIAL_EXPLANATIONS = [
    { metric: "Runway", meaning: "The number of months a startup can continue operating before running out of cash, assuming current burn rate and available funds.", interpretation: "18+ months = healthy; 12–18 = adequate; <12 = concerning. Longer is always better — it means more time to iterate and reach milestones." },
    { metric: "Burn Multiple", meaning: "How much money is burned to generate each dollar of net new annual recurring revenue (ARR). Formula: Annual Burn / Net New ARR.", interpretation: "<1x = excellent efficiency; 1–2x = good; 2–4x = average; >4x = inefficient. Lower is better — it shows capital-efficient growth." },
    { metric: "Bankruptcy Projection", meaning: "Months until cash runs out WITHOUT new fundraising — only existing cash divided by net burn.", interpretation: "This is the 'worst-case' scenario. If <6 months, the company is extremely dependent on this fundraise closing." },
    { metric: "Capital Efficiency", meaning: "Revenue generated per dollar of total capital (existing cash + raise). Formula: Revenue / Total Capital.", interpretation: ">0.5 = strong revenue relative to capital; 0.1–0.5 = developing; <0.1 = pre-revenue or very capital-intensive." },
    { metric: "Valuation Flag", meaning: "Whether the pre-money valuation appears unrealistic relative to revenue, stage, and sector benchmarks.", interpretation: "✓ OK = valuation is reasonable. ⚠ Flagged = valuation may be overly optimistic and warrants negotiation." },
];

const MARKET_FOUNDER_EXPLANATIONS = [
    { metric: "Market Momentum", meaning: "Real-world demand signal based on Google Trends data, news coverage, and growth plausibility.", interpretation: "70–100 = strong market tailwinds; 40–69 = moderate interest; <40 = weak or declining demand." },
    { metric: "Hype vs Evidence", meaning: "The delta between claimed growth rate and actual market evidence. Positive = more hype than substance.", interpretation: "Close to 0 = claims match evidence. Large positive = founder may be over-promising. Negative = under-selling (rare but positive signal)." },
    { metric: "Competitive Saturation", meaning: "How crowded the market is. Higher = less competition. Considers named competitors, sector density, and market signals.", interpretation: "80–100 = blue ocean (very rare); 50–79 = moderate competition; <50 = crowded 'red ocean' market." },
    { metric: "Founder Risk Level", meaning: "Overall risk assessment of the founding team based on experience, domain fit, network, and execution track record.", interpretation: "LOW = strong founding team; MEDIUM = some gaps but manageable; HIGH = significant concerns about execution capability." },
    { metric: "Domain Fit", meaning: "How well the founder's background and experience align with the startup's sector and stage.", interpretation: "70–100 = strong domain expertise; 40–69 = adjacent experience; <40 = limited relevant background." },
];

const RISKS_EXPLANATION = "Key risks are the most critical factors that could cause the investment to underperform or fail. They are ranked by the AI's assessment of likelihood and impact. Address these in due diligence conversations with the founding team.";

const MILESTONES_EXPLANATION = "Required milestones are specific achievements the startup should reach before or shortly after investment. They serve as checkpoints and may be tied to tranche releases or follow-on investment decisions.";

// ─── Chart color palette — Forest theme ─────────────────────────────────────

const CHART_COLORS = ["#1B4332", "#2D6A4F", "#B07D62", "#40916C", "#5C4033"];
const RADAR_COLOR = "#1B4332";

export default function Step4_Results({ result, onReset }) {
    const memoRef = useRef(null);
    const [expandedSections, setExpandedSections] = useState({});

    const toggleSection = (key) => {
        setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
    };

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
    const scoreColor = d.decision_score >= 70 ? "var(--forest-lighter)" : d.decision_score >= 40 ? "var(--warning)" : "var(--danger)";

    // ─── Chart data ────────────────────────────────────────────────────────
    const radarData = [
        { subject: "Decision", value: d.decision_score, fullMark: 100 },
        { subject: "Financial", value: fr.sustainability_score, fullMark: 100 },
        { subject: "Market", value: mv.market_momentum_score, fullMark: 100 },
        { subject: "Competition", value: mv.competitive_saturation_score, fullMark: 100 },
        { subject: "Founder", value: fi.founder_intelligence_score, fullMark: 100 },
    ];

    const financialBarData = [
        { name: "Runway (mo)", value: sim.runway_months ?? 0, benchmark: 18 },
        { name: "Burn Multiple", value: sim.burn_multiple ?? 0, benchmark: 2 },
        { name: "Cap. Efficiency", value: (sim.capital_efficiency_ratio ?? 0) * 100, benchmark: 50 },
    ];

    const founderPieData = [
        { name: "Domain Fit", value: fi.domain_fit_score },
        { name: "Network", value: fi.network_strength_score },
        { name: "Execution", value: fi.execution_credibility_score },
    ];

    return (
        <div className="animate-fadeUp">
            {/* Hero Decision Card */}
            <div className="card" style={{
                marginBottom: "1.5rem", padding: "2.25rem",
                textAlign: "center", position: "relative",
                overflow: "hidden"
            }}>
                {/* Decorative shapes */}
                <div style={{
                    position: "absolute", top: -30, right: -30,
                    width: 100, height: 100, borderRadius: "50%",
                    background: `${scoreColor}10`, pointerEvents: "none"
                }} />
                <div style={{
                    position: "absolute", bottom: -40, left: -40,
                    width: 120, height: 120, borderRadius: "50%",
                    background: "var(--cream-dark)", pointerEvents: "none"
                }} />

                {/* Decision Badge */}
                <div style={{ marginBottom: "1.25rem" }}>
                    <span className={`badge ${badgeClass}`} style={{
                        fontSize: "0.82rem", padding: "0.35rem 1.15rem",
                        letterSpacing: "0.06em"
                    }}>
                        {decisionLabel}
                    </span>
                </div>

                {/* Score Gauge */}
                <div style={{ position: "relative", width: 140, height: 140, margin: "0 auto 1.25rem" }}>
                    <svg viewBox="0 0 150 150" style={{ transform: "rotate(-90deg)" }}>
                        <circle cx="75" cy="75" r="62" fill="none" stroke="var(--sand)" strokeWidth="7" />
                        <circle cx="75" cy="75" r="62" fill="none"
                            stroke={scoreColor} strokeWidth="7"
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
                            fontSize: "2.5rem", fontWeight: 700,
                            fontFamily: "var(--font-heading)",
                            color: scoreColor, lineHeight: 1
                        }}>
                            {d.decision_score}
                        </div>
                        <div style={{
                            fontSize: "0.62rem", fontWeight: 700,
                            textTransform: "uppercase", letterSpacing: "0.1em",
                            color: "var(--slate)", marginTop: "0.2rem"
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
                                fontSize: "0.62rem", fontWeight: 700,
                                textTransform: "uppercase", letterSpacing: "0.08em",
                                color: "var(--slate)", marginBottom: "0.15rem"
                            }}>{item.label}</div>
                            <div style={{
                                fontSize: "0.95rem", fontWeight: 600,
                                color: "var(--charcoal)"
                            }}>{item.value}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ═══ Radar Chart ═══ */}
            <div className="card" style={{ padding: "1.5rem", marginBottom: "1.25rem" }}>
                <SectionHeader
                    icon={<Activity size={16} color="var(--forest)" />}
                    iconBg="var(--sage-light)"
                    title="Overall Assessment Radar"
                    sectionKey="radar_info"
                    expanded={false}
                    onToggle={() => { }}
                    showToggle={false}
                />
                <div style={{ width: "100%", height: 280 }}>
                    <ResponsiveContainer>
                        <RadarChart data={radarData} outerRadius="75%">
                            <PolarGrid stroke="var(--sand)" />
                            <PolarAngleAxis
                                dataKey="subject"
                                tick={{ fill: "var(--slate)", fontSize: 12, fontFamily: "var(--font-body)" }}
                            />
                            <PolarRadiusAxis
                                angle={90} domain={[0, 100]}
                                tick={{ fill: "var(--slate)", fontSize: 10 }}
                            />
                            <Radar
                                name="Score" dataKey="value"
                                stroke={RADAR_COLOR} fill={RADAR_COLOR} fillOpacity={0.15}
                                strokeWidth={2}
                            />
                        </RadarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Metrics Grid */}
            <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr",
                gap: "1.25rem", marginBottom: "1.25rem"
            }}>
                {/* Financial Card */}
                <div className="card" style={{ padding: "1.5rem" }}>
                    <SectionHeader
                        icon={<BarChart3 size={16} color="var(--copper)" />}
                        iconBg="#FDF2E9"
                        title="Financial Profile"
                        sectionKey="financial"
                        expanded={expandedSections.financial}
                        onToggle={toggleSection}
                    />

                    {expandedSections.financial && (
                        <ExplanationPanel explanations={FINANCIAL_EXPLANATIONS} />
                    )}

                    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                        <MetricRow label="Runway" value={fmtFallback(sim.runway_months, " mo")} />
                        <MetricRow label="Burn Multiple" value={fmtFallback(sim.burn_multiple, "x")} />
                        <MetricRow label="Bankruptcy Proj." value={fmtFallback(sim.bankruptcy_projection_months, " mo")} />
                        <MetricRow label="Capital Efficiency" value={sim.capital_efficiency_ratio} />
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ color: "var(--slate)", fontSize: "0.88rem" }}>Valuation Flag</span>
                            <span className={`badge ${fr.valuation_realism_flag ? "badge--red" : "badge--green"}`}>
                                {fr.valuation_realism_flag ? "⚠ Flagged" : "✓ OK"}
                            </span>
                        </div>
                    </div>

                    {/* Financial Bar Chart */}
                    <div style={{ marginTop: "1.25rem", paddingTop: "0.85rem", borderTop: "1px solid var(--sand)" }}>
                        <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--slate)", marginBottom: "0.5rem" }}>
                            vs Benchmarks
                        </div>
                        <div style={{ width: "100%", height: 160 }}>
                            <ResponsiveContainer>
                                <BarChart data={financialBarData} layout="vertical" margin={{ left: 10, right: 10 }}>
                                    <XAxis type="number" tick={{ fontSize: 10, fill: "var(--slate)" }} />
                                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11, fill: "var(--charcoal)" }} />
                                    <Tooltip
                                        contentStyle={{
                                            background: "var(--white)", border: "1px solid var(--sand)",
                                            borderRadius: "8px", fontSize: "0.82rem", fontFamily: "var(--font-body)"
                                        }}
                                    />
                                    <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} name="Actual" />
                                    <Bar dataKey="benchmark" fill="var(--sand)" radius={[0, 4, 4, 0]} name="Benchmark" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Market & Founder Card */}
                <div className="card" style={{ padding: "1.5rem" }}>
                    <SectionHeader
                        icon={<Target size={16} color="var(--forest)" />}
                        iconBg="var(--sage-light)"
                        title="Market & Founder"
                        sectionKey="market"
                        expanded={expandedSections.market}
                        onToggle={toggleSection}
                    />

                    {expandedSections.market && (
                        <ExplanationPanel explanations={MARKET_FOUNDER_EXPLANATIONS} />
                    )}

                    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                        <MetricRow label="Market Momentum" value={`${mv.market_momentum_score}/100`} />
                        <MetricRow label="Hype vs Evidence" value={mv.hype_vs_evidence_delta} />
                        <MetricRow label="Competitive Saturation" value={`${mv.competitive_saturation_score}/100`} />
                        <div style={{
                            display: "flex", justifyContent: "space-between",
                            alignItems: "center", marginTop: "0.4rem",
                            paddingTop: "0.4rem", borderTop: "1px solid var(--sand)"
                        }}>
                            <span style={{ color: "var(--slate)", fontSize: "0.88rem" }}>Founder Risk</span>
                            <span className={`badge ${fi.risk_level === "HIGH" ? "badge--red" : fi.risk_level === "MEDIUM" ? "badge--yellow" : "badge--green"}`}>
                                {fi.risk_level}
                            </span>
                        </div>
                        <MetricRow label="Domain Fit" value={`${fi.domain_fit_score}/100`} />
                    </div>

                    {/* Founder Pie Chart */}
                    <div style={{ marginTop: "1.25rem", paddingTop: "0.85rem", borderTop: "1px solid var(--sand)" }}>
                        <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--slate)", marginBottom: "0.5rem" }}>
                            Founder Score Breakdown
                        </div>
                        <div style={{ width: "100%", height: 200 }}>
                            <ResponsiveContainer>
                                <PieChart>
                                    <Pie
                                        data={founderPieData} cx="50%" cy="50%"
                                        innerRadius={45} outerRadius={75}
                                        paddingAngle={3} dataKey="value"
                                        label={({ name, value }) => `${value}`}
                                    >
                                        {founderPieData.map((_, idx) => (
                                            <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            background: "var(--white)", border: "1px solid var(--sand)",
                                            borderRadius: "8px", fontSize: "0.82rem"
                                        }}
                                    />
                                    <Legend
                                        wrapperStyle={{ fontSize: "0.78rem", fontFamily: "var(--font-body)" }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>

            {/* Risks & Milestones */}
            <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr",
                gap: "1.25rem", marginBottom: "1.75rem"
            }}>
                <div className="card" style={{ padding: "1.5rem" }}>
                    <SectionHeader
                        icon={<AlertTriangle size={16} color="var(--danger)" />}
                        iconBg="var(--danger-bg)"
                        title="Key Risks"
                        sectionKey="risks"
                        expanded={expandedSections.risks}
                        onToggle={toggleSection}
                    />

                    {expandedSections.risks && (
                        <div style={{
                            padding: "0.75rem 1rem", marginBottom: "0.75rem",
                            background: "var(--cream-dark)", borderRadius: "var(--radius-md)",
                            fontSize: "0.8rem", color: "var(--slate)", lineHeight: 1.6
                        }}>
                            {RISKS_EXPLANATION}
                        </div>
                    )}

                    <ul style={{
                        paddingLeft: "1.25rem", display: "flex",
                        flexDirection: "column", gap: "0.35rem"
                    }}>
                        {d.key_risks?.length
                            ? d.key_risks.map((r, i) => (
                                <li key={i} style={{ color: "var(--slate)", fontSize: "0.88rem" }}>{r}</li>
                            ))
                            : <li style={{ color: "var(--slate)", fontSize: "0.88rem" }}>No major risks identified.</li>
                        }
                    </ul>
                </div>

                <div className="card" style={{ padding: "1.5rem" }}>
                    <SectionHeader
                        icon={<CheckCircle size={16} color="var(--success)" />}
                        iconBg="var(--success-bg)"
                        title="Required Milestones"
                        sectionKey="milestones"
                        expanded={expandedSections.milestones}
                        onToggle={toggleSection}
                    />

                    {expandedSections.milestones && (
                        <div style={{
                            padding: "0.75rem 1rem", marginBottom: "0.75rem",
                            background: "var(--cream-dark)", borderRadius: "var(--radius-md)",
                            fontSize: "0.8rem", color: "var(--slate)", lineHeight: 1.6
                        }}>
                            {MILESTONES_EXPLANATION}
                        </div>
                    )}

                    <ul style={{
                        paddingLeft: "1.25rem", display: "flex",
                        flexDirection: "column", gap: "0.35rem"
                    }}>
                        {d.required_milestones?.length
                            ? d.required_milestones.map((m, i) => (
                                <li key={i} style={{ color: "var(--slate)", fontSize: "0.88rem" }}>{m}</li>
                            ))
                            : <li style={{ color: "var(--slate)", fontSize: "0.88rem" }}>No specific milestones.</li>
                        }
                    </ul>
                </div>
            </div>

            {/* Investment Memo */}
            <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: "2rem" }}>
                <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "1.1rem 1.5rem",
                    background: "var(--cream-dark)",
                    borderBottom: "1px solid var(--sand)"
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <FileText size={18} color="var(--charcoal)" />
                        <h3 style={{ fontSize: "1.1rem" }}>Investment Memo</h3>
                    </div>
                    <button className="btn btn--forest btn--sm" onClick={downloadPDF}>
                        <Download size={14} /> Download PDF
                    </button>
                </div>
                <div style={{ padding: "1.5rem" }}>
                    <div ref={memoRef} style={{
                        background: "var(--white)", padding: "1.5rem",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--sand)"
                    }}>
                        <pre style={{
                            whiteSpace: "pre-wrap",
                            fontFamily: "var(--font-body)",
                            fontSize: "0.88rem",
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
                <button className="btn btn--lg" onClick={onReset}>
                    <RefreshCw size={18} /> Start New Analysis
                </button>
            </div>
        </div>
    );
}

/* ─── Section Header with Info Toggle ─────────────────────────────────────── */
function SectionHeader({ icon, iconBg, title, sectionKey, expanded, onToggle, showToggle = true }) {
    return (
        <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: "1.15rem", paddingBottom: "0.65rem",
            borderBottom: "1px solid var(--sand)"
        }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div style={{
                    width: 30, height: 30, borderRadius: "var(--radius-sm)",
                    background: iconBg, display: "flex",
                    alignItems: "center", justifyContent: "center"
                }}>
                    {icon}
                </div>
                <h3 style={{ fontSize: "1.05rem" }}>{title}</h3>
            </div>
            {showToggle && (
                <button
                    onClick={() => onToggle(sectionKey)}
                    style={{
                        border: "none", background: expanded ? "var(--cream-dark)" : "transparent",
                        cursor: "pointer", display: "flex", alignItems: "center", gap: "0.25rem",
                        padding: "0.25rem 0.6rem", borderRadius: "var(--radius-full)",
                        color: "var(--slate)", fontSize: "0.7rem", fontWeight: 600,
                        fontFamily: "var(--font-body)", transition: "all 0.2s ease"
                    }}
                >
                    <Info size={11} />
                    {expanded ? "Hide" : "What do these mean?"}
                    {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                </button>
            )}
        </div>
    );
}

/* ─── Explanation Panel ───────────────────────────────────────────────────── */
function ExplanationPanel({ explanations }) {
    return (
        <div style={{
            marginBottom: "0.85rem", padding: "1rem",
            background: "var(--cream-dark)", borderRadius: "var(--radius-md)",
            display: "flex", flexDirection: "column", gap: "0.65rem",
            border: "1px solid var(--sand)"
        }}>
            {explanations.map((item, i) => (
                <div key={i}>
                    <div style={{ fontWeight: 700, fontSize: "0.8rem", color: "var(--charcoal)", marginBottom: "0.1rem" }}>
                        {item.metric}
                    </div>
                    <div style={{ fontSize: "0.76rem", color: "var(--slate)", lineHeight: 1.5 }}>
                        <strong>What it is:</strong> {item.meaning}
                    </div>
                    <div style={{ fontSize: "0.76rem", color: "var(--slate)", lineHeight: 1.5 }}>
                        <strong>How to read:</strong> {item.interpretation}
                    </div>
                </div>
            ))}
        </div>
    );
}

/* ─── Metric Row ──────────────────────────────────────────────────────────── */
function MetricRow({ label, value }) {
    return (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "var(--slate)", fontSize: "0.88rem" }}>{label}</span>
            <strong style={{ fontSize: "0.92rem", fontFamily: "var(--font-body)", color: "var(--charcoal)" }}>{value}</strong>
        </div>
    );
}
