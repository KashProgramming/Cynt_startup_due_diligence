import React, { useState, useEffect } from "react";
import {
    Eye, PlayCircle, Clock, CheckCircle, FileText, Users,
    RefreshCw, UserPlus, Handshake, X, Search, Linkedin
} from "lucide-react";
import { Header } from "./EntrepreneurDashboard";
import Step4_Results from "./Step4_Results";
import { api } from "../api";

export default function InvestorDashboard({ user, apiOnline, onLogout }) {
    const [tab, setTab] = useState("applications"); // "applications" | "collabs"
    const [applications, setApplications] = useState([]);
    const [collaborations, setCollaborations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState(null);
    const [viewingResult, setViewingResult] = useState(null);
    const [error, setError] = useState("");

    // Collaboration modal state
    const [collabModal, setCollabModal] = useState(null); // { appId, collabDoc }
    const [allInvestors, setAllInvestors] = useState([]);
    const [inviteSearch, setInviteSearch] = useState("");
    const [inviting, setInviting] = useState(false);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [apps, collabs, investors] = await Promise.all([
                api.getInvestorApplications(user._id),
                api.getMyCollaborations(user._id),
                api.getInvestors(),
            ]);
            setApplications(apps);
            setCollaborations(collabs);
            setAllInvestors(investors);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAll(); }, [user._id]);

    const handleAnalyze = async (appId) => {
        setAnalyzing(appId);
        setError("");
        try {
            const result = await api.analyzeApplication(appId);
            setViewingResult(result);
            await fetchAll();
        } catch (err) {
            setError(err.message);
        } finally {
            setAnalyzing(null);
        }
    };

    const handleViewResult = (app) => {
        if (app.analysis_result) setViewingResult(app.analysis_result);
    };

    // ─── Collaboration Handlers ──────────────────────────────────────────

    const openCollabModal = async (app) => {
        let collab = await api.getCollaborationForApp(app._id);
        if (!collab) {
            collab = await api.createCollaboration(app._id, user._id, user.name);
        }
        setCollabModal({ appId: app._id, collab, companyName: app.company_name });
        setInviteSearch("");
    };

    const handleInvite = async (investor) => {
        if (!collabModal) return;
        setInviting(true);
        try {
            const updated = await api.inviteCollaborator(collabModal.collab._id, investor._id, investor.name);
            setCollabModal({ ...collabModal, collab: updated });
            await fetchAll();
        } catch (err) {
            setError(err.message);
        } finally {
            setInviting(false);
        }
    };

    const handleCollabAssess = async (collab) => {
        setAnalyzing(collab._id);
        setError("");
        try {
            const result = await api.assessAsCollaborator(collab._id, user._id);
            setViewingResult(result);
            await fetchAll();
        } catch (err) {
            setError(err.message);
        } finally {
            setAnalyzing(null);
        }
    };

    // ─── Viewing result ──────────────────────────────────────────────────

    if (viewingResult) {
        return (
            <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
                <Header user={user} apiOnline={apiOnline} onLogout={onLogout} />
                <main className="container" style={{ flex: 1, padding: "2rem 2rem 4rem" }}>
                    <Step4_Results result={viewingResult} onReset={() => setViewingResult(null)} />
                </main>
            </div>
        );
    }

    // ─── Filter investors for invite ─────────────────────────────────────

    const alreadyInvitedIds = collabModal
        ? [collabModal.collab.lead_investor_id, ...(collabModal.collab.collaborators || []).map(c => c.investor_id)]
        : [];
    const invitableInvestors = allInvestors.filter(inv =>
        !alreadyInvitedIds.includes(inv._id) &&
        (inv.name.toLowerCase().includes(inviteSearch.toLowerCase()) ||
            (inv.sectors || []).some(s => s.toLowerCase().includes(inviteSearch.toLowerCase())))
    );

    return (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
            <Header user={user} apiOnline={apiOnline} onLogout={onLogout} />

            <main className="container" style={{ flex: 1, padding: "2rem 2rem 4rem" }}>
                <div className="animate-fadeUp">
                    {/* Tabs */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
                        <div style={{
                            display: "flex", gap: "0.5rem",
                            background: "var(--bg-elevated)", borderRadius: "var(--radius-full)",
                            padding: "4px"
                        }}>
                            {[{ key: "applications", label: "My Applications" }, { key: "collabs", label: "Collaborations" }].map(t => (
                                <button key={t.key} onClick={() => setTab(t.key)} style={{
                                    padding: "0.5rem 1.25rem", border: "none",
                                    borderRadius: "var(--radius-full)", cursor: "pointer",
                                    fontFamily: "var(--font-body)", fontSize: "0.85rem", fontWeight: 600,
                                    background: tab === t.key ? "var(--bg-card)" : "transparent",
                                    color: tab === t.key ? "var(--charcoal)" : "var(--warm-gray)",
                                    boxShadow: tab === t.key ? "var(--shadow-sm)" : "none",
                                    transition: "all 0.2s ease",
                                    display: "flex", alignItems: "center", gap: "0.4rem"
                                }}>
                                    {t.key === "collabs" && <Handshake size={14} />}
                                    {t.label}
                                    {t.key === "collabs" && collaborations.length > 0 && (
                                        <span style={{
                                            background: "var(--terracotta)", color: "#fff",
                                            borderRadius: "50%", width: 18, height: 18,
                                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                                            fontSize: "0.65rem", fontWeight: 700
                                        }}>{collaborations.length}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                        <button className="btn" onClick={fetchAll} style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}>
                            <RefreshCw size={15} /> Refresh
                        </button>
                    </div>

                    {error && (
                        <div style={{
                            padding: "0.75rem 1rem", borderRadius: "var(--radius-sm)",
                            background: "var(--danger-bg)", color: "var(--terracotta-dark)",
                            fontSize: "0.9rem", marginBottom: "1rem"
                        }}>{error}</div>
                    )}

                    {/* Analyzing overlay */}
                    {analyzing && (
                        <div className="card animate-scaleIn" style={{
                            textAlign: "center", padding: "3rem", marginBottom: "1.5rem",
                            background: "var(--bg-elevated)"
                        }}>
                            <div style={{
                                width: 80, height: 80, margin: "0 auto 1.5rem",
                                borderRadius: "50%", border: "4px solid var(--light-border)",
                                borderTopColor: "var(--terracotta)",
                                animation: "rotateGeo 1s linear infinite"
                            }} />
                            <h3 style={{ fontSize: "1.3rem", marginBottom: "0.5rem" }}>Running AI Analysis</h3>
                            <p style={{ color: "var(--warm-gray)" }}>
                                Scraping LinkedIn, extracting profiles, running simulations…
                            </p>
                        </div>
                    )}

                    {/* ═══ Applications Tab ═══ */}
                    {tab === "applications" && (
                        <>
                            <div style={{ marginBottom: "1.5rem" }}>
                                <h2 style={{ fontSize: "1.8rem", marginBottom: "0.3rem" }}>Startup Applications</h2>
                                <p style={{ color: "var(--warm-gray)" }}>Review and assess startups that applied to you.</p>
                            </div>

                            {/* Stats */}
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "2rem" }}>
                                <StatCard label="Total" value={applications.length} icon={<Users size={18} />} bg="var(--bg-elevated)" />
                                <StatCard label="Pending" value={applications.filter(a => a.status === "pending").length}
                                    icon={<Clock size={18} />} bg="var(--warning-bg)" />
                                <StatCard label="Analyzed" value={applications.filter(a => a.status === "analyzed").length}
                                    icon={<CheckCircle size={18} />} bg="var(--success-bg)" />
                            </div>

                            {loading ? (
                                <div style={{ textAlign: "center", padding: "3rem", color: "var(--warm-gray)" }}>Loading…</div>
                            ) : applications.length === 0 ? (
                                <div className="card" style={{ textAlign: "center", padding: "3rem 2rem" }}>
                                    <FileText size={48} color="var(--light-border)" style={{ marginBottom: "1rem" }} />
                                    <p style={{ color: "var(--warm-gray)", fontSize: "1.1rem" }}>No applications yet.</p>
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                    {applications.map(app => (
                                        <div key={app._id} className="card" style={{ padding: "1.25rem 1.5rem" }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                                                <div style={{ flex: 1, minWidth: 200 }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                                        <div style={{
                                                            width: 38, height: 38, borderRadius: "50%",
                                                            background: "var(--bg-elevated)", display: "flex",
                                                            alignItems: "center", justifyContent: "center",
                                                            fontWeight: 700, fontSize: "0.9rem", color: "var(--charcoal)"
                                                        }}>
                                                            {app.company_name?.charAt(0) || "?"}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>{app.company_name}</div>
                                                            <div style={{ fontSize: "0.8rem", color: "var(--warm-gray)" }}>
                                                                by {app.entrepreneur_name}
                                                            </div>
                                                            {app.linkedin_url && (
                                                                <a href={app.linkedin_url} target="_blank" rel="noreferrer"
                                                                    style={{ fontSize: "0.72rem", color: "var(--olive)", display: "flex", alignItems: "center", gap: "0.2rem", textDecoration: "none", marginTop: "0.1rem" }}>
                                                                    <Linkedin size={11} /> LinkedIn Profile
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                                                    <span className={`badge ${app.status === "analyzed" ? "badge--green" : "badge--yellow"}`}>
                                                        {app.status === "analyzed" ? <><CheckCircle size={12} /> Analyzed</> : <><Clock size={12} /> Pending</>}
                                                    </span>

                                                    {app.status === "pending" ? (
                                                        <button className="btn btn--accent" onClick={() => handleAnalyze(app._id)}
                                                            disabled={analyzing !== null}
                                                            style={{ padding: "0.5rem 1rem", fontSize: "0.82rem" }}>
                                                            <PlayCircle size={14} /> Assess
                                                        </button>
                                                    ) : (
                                                        <button className="btn" onClick={() => handleViewResult(app)}
                                                            style={{ padding: "0.5rem 1rem", fontSize: "0.82rem" }}>
                                                            <Eye size={14} /> Report
                                                        </button>
                                                    )}

                                                    <button className="btn" onClick={() => openCollabModal(app)}
                                                        style={{ padding: "0.5rem 1rem", fontSize: "0.82rem" }}>
                                                        <Handshake size={14} /> Collaborate
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {/* ═══ Collaborations Tab ═══ */}
                    {tab === "collabs" && (
                        <>
                            <div style={{ marginBottom: "1.5rem" }}>
                                <h2 style={{ fontSize: "1.8rem", marginBottom: "0.3rem" }}>Collaboration Hub</h2>
                                <p style={{ color: "var(--warm-gray)" }}>
                                    Deals you're collaborating on with other investors.
                                </p>
                            </div>

                            {collaborations.length === 0 ? (
                                <div className="card" style={{ textAlign: "center", padding: "3rem 2rem" }}>
                                    <Handshake size={48} color="var(--light-border)" style={{ marginBottom: "1rem" }} />
                                    <p style={{ color: "var(--warm-gray)", fontSize: "1.1rem" }}>No collaborations yet.</p>
                                    <p style={{ color: "var(--warm-gray)", fontSize: "0.9rem", marginTop: "0.5rem" }}>
                                        Click "Collaborate" on an application to start one.
                                    </p>
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                    {collaborations.map(collab => {
                                        const isLead = collab.lead_investor_id === user._id;
                                        const myEntry = (collab.collaborators || []).find(c => c.investor_id === user._id);
                                        const canAssess = !isLead && myEntry && myEntry.status === "invited";
                                        const hasResult = !isLead && myEntry && myEntry.status === "assessed";

                                        return (
                                            <div key={collab._id} className="card" style={{ padding: "1.5rem" }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                                                    <div>
                                                        <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{collab.company_name}</div>
                                                        <div style={{ fontSize: "0.82rem", color: "var(--warm-gray)", marginTop: "0.15rem" }}>
                                                            by {collab.entrepreneur_name} • Lead: <strong>{collab.lead_investor_name}</strong>
                                                        </div>
                                                        {isLead && (
                                                            <span className="badge badge--yellow" style={{ marginTop: "0.5rem" }}>
                                                                You are lead
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div style={{ display: "flex", gap: "0.5rem" }}>
                                                        {canAssess && (
                                                            <button className="btn btn--accent" onClick={() => handleCollabAssess(collab)}
                                                                disabled={analyzing !== null}
                                                                style={{ padding: "0.5rem 1rem", fontSize: "0.82rem" }}>
                                                                <PlayCircle size={14} /> Run My Assessment
                                                            </button>
                                                        )}
                                                        {hasResult && (
                                                            <button className="btn" onClick={() => setViewingResult(myEntry.analysis_result)}
                                                                style={{ padding: "0.5rem 1rem", fontSize: "0.82rem" }}>
                                                                <Eye size={14} /> My Report
                                                            </button>
                                                        )}
                                                        {isLead && (
                                                            <button className="btn" onClick={() => {
                                                                setCollabModal({ appId: collab.application_id, collab, companyName: collab.company_name });
                                                                setInviteSearch("");
                                                            }}
                                                                style={{ padding: "0.5rem 1rem", fontSize: "0.82rem" }}>
                                                                <UserPlus size={14} /> Invite
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Collaborators list */}
                                                {(collab.collaborators || []).length > 0 && (
                                                    <div style={{ marginTop: "1rem", paddingTop: "0.75rem", borderTop: "1px solid var(--light-border)" }}>
                                                        <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--warm-gray)", marginBottom: "0.5rem" }}>
                                                            Co-Investors
                                                        </div>
                                                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                                                            {collab.collaborators.map((c, i) => (
                                                                <div key={i} style={{
                                                                    display: "flex", alignItems: "center", gap: "0.4rem",
                                                                    padding: "0.35rem 0.75rem",
                                                                    borderRadius: "var(--radius-full)",
                                                                    background: "var(--bg-elevated)",
                                                                    fontSize: "0.82rem", fontWeight: 600,
                                                                    border: "1px solid var(--light-border)"
                                                                }}>
                                                                    <div style={{
                                                                        width: 22, height: 22, borderRadius: "50%",
                                                                        background: c.status === "assessed" ? "var(--olive)" : "var(--warm-gray)",
                                                                        color: "#fff", display: "flex", alignItems: "center",
                                                                        justifyContent: "center", fontSize: "0.6rem", fontWeight: 700
                                                                    }}>
                                                                        {c.investor_name?.charAt(0) || "?"}
                                                                    </div>
                                                                    {c.investor_name}
                                                                    <span className={`badge ${c.status === "assessed" ? "badge--green" : "badge--yellow"}`}
                                                                        style={{ padding: "0.15rem 0.4rem", fontSize: "0.65rem" }}>
                                                                        {c.status}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* ═══ Collaboration Modal ═══ */}
                {collabModal && (
                    <div style={{
                        position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        zIndex: 100, backdropFilter: "blur(4px)"
                    }} onClick={() => setCollabModal(null)}>
                        <div className="card animate-scaleIn" style={{
                            width: "100%", maxWidth: 520, padding: "2rem",
                            maxHeight: "80vh", overflowY: "auto"
                        }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                                <div>
                                    <h3 style={{ fontSize: "1.2rem" }}>
                                        <Handshake size={18} style={{ verticalAlign: -3, marginRight: 6 }} />
                                        Collaborate on {collabModal.companyName}
                                    </h3>
                                    <p style={{ fontSize: "0.82rem", color: "var(--warm-gray)", marginTop: "0.2rem" }}>
                                        Invite investors to co-invest and run their own assessment.
                                    </p>
                                </div>
                                <button onClick={() => setCollabModal(null)} style={{
                                    border: "none", background: "none", cursor: "pointer",
                                    color: "var(--warm-gray)", padding: "0.25rem"
                                }}><X size={20} /></button>
                            </div>

                            {/* Already invited */}
                            {(collabModal.collab.collaborators || []).length > 0 && (
                                <div style={{ marginBottom: "1.5rem" }}>
                                    <label>Invited Investors</label>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                        {collabModal.collab.collaborators.map((c, i) => (
                                            <div key={i} style={{
                                                display: "flex", justifyContent: "space-between", alignItems: "center",
                                                padding: "0.5rem 0.75rem", borderRadius: "var(--radius-sm)",
                                                background: "var(--bg-elevated)"
                                            }}>
                                                <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{c.investor_name}</span>
                                                <span className={`badge ${c.status === "assessed" ? "badge--green" : "badge--yellow"}`}
                                                    style={{ fontSize: "0.7rem" }}>{c.status}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Invite new */}
                            <label>Invite New Investor</label>
                            <div style={{ position: "relative", marginBottom: "0.75rem" }}>
                                <Search size={14} style={{
                                    position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
                                    color: "var(--warm-gray)"
                                }} />
                                <input type="text" placeholder="Search investors…"
                                    value={inviteSearch}
                                    onChange={(e) => setInviteSearch(e.target.value)}
                                    style={{ paddingLeft: "2rem", fontSize: "0.85rem" }}
                                />
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: 200, overflowY: "auto" }}>
                                {invitableInvestors.map(inv => (
                                    <div key={inv._id} style={{
                                        display: "flex", justifyContent: "space-between", alignItems: "center",
                                        padding: "0.65rem 0.85rem", borderRadius: "var(--radius-sm)",
                                        border: "1px solid var(--light-border)", background: "var(--bg-card)"
                                    }}>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{inv.name}</div>
                                            <div style={{ fontSize: "0.72rem", color: "var(--warm-gray)" }}>
                                                {inv.investor_type?.replace("_", " ")} • {(inv.sectors || []).slice(0, 3).join(", ")}
                                            </div>
                                        </div>
                                        <button className="btn btn--accent" onClick={() => handleInvite(inv)}
                                            disabled={inviting}
                                            style={{ padding: "0.35rem 0.85rem", fontSize: "0.78rem" }}>
                                            <UserPlus size={13} /> Invite
                                        </button>
                                    </div>
                                ))}
                                {invitableInvestors.length === 0 && (
                                    <p style={{ textAlign: "center", color: "var(--warm-gray)", fontSize: "0.85rem", padding: "1rem" }}>
                                        No available investors to invite.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

function StatCard({ label, value, icon, bg }) {
    return (
        <div className="card" style={{
            padding: "1.25rem 1.5rem", display: "flex",
            alignItems: "center", gap: "1rem", background: bg
        }}>
            <div style={{
                width: 40, height: 40, borderRadius: "var(--radius-sm)",
                background: "var(--bg-card)", display: "flex",
                alignItems: "center", justifyContent: "center",
                boxShadow: "var(--shadow-xs)"
            }}>{icon}</div>
            <div>
                <div style={{ fontSize: "1.6rem", fontWeight: 700, fontFamily: "var(--font-display)", lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: "0.72rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--warm-gray)" }}>{label}</div>
            </div>
        </div>
    );
}
