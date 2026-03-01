import React, { useState, useEffect } from "react";
import {
    Eye, PlayCircle, Clock, CheckCircle, FileText, Users,
    RefreshCw, UserPlus, Handshake, X, Search, Linkedin,
    ArrowLeft, ThumbsUp, ThumbsDown, XCircle, Award
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
    const [viewingAppId, setViewingAppId] = useState(null); // track which app's result we're viewing
    const [error, setError] = useState("");

    // Decision modal
    const [decisionModal, setDecisionModal] = useState(null); // { appId, companyName }
    const [decisionType, setDecisionType] = useState(null); // "approved" | "rejected"
    const [decisionMsg, setDecisionMsg] = useState("");
    const [decidingLoading, setDecidingLoading] = useState(false);

    // Collaboration modal
    const [collabModal, setCollabModal] = useState(null);
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

    // ─── Merged list: own apps + collab apps (for My Applications tab) ───
    const collabAppsFromCollabs = collaborations
        .filter(c => c.lead_investor_id !== user._id) // only show collabs where I'm NOT lead (invited)
        .map(c => {
            const myEntry = (c.collaborators || []).find(co => co.investor_id === user._id);
            return {
                _id: c.application_id,
                company_name: c.company_name,
                entrepreneur_name: c.entrepreneur_name || "—",
                linkedin_url: c.linkedin_url,
                status: myEntry?.status === "assessed" ? "analyzed" : "pending",
                analysis_result: myEntry?.analysis_result || null,
                investor_name: c.lead_investor_name,
                isCollab: true,
                collabId: c._id,
                collabStatus: myEntry?.status,
            };
        });

    const allApps = [...applications, ...collabAppsFromCollabs];

    // ─── Stats across the merged list ────────────────────────────────────
    const totalCount = allApps.length;
    const pendingCount = allApps.filter(a => a.status === "pending").length;
    const analyzedCount = allApps.filter(a => a.status === "analyzed").length;
    const decidedCount = allApps.filter(a => a.status === "approved" || a.status === "rejected").length;

    // ─── Handlers ────────────────────────────────────────────────────────

    const handleAnalyze = async (appId, isCollab, collabId) => {
        setAnalyzing(appId);
        setError("");
        try {
            let result;
            if (isCollab) {
                result = await api.assessAsCollaborator(collabId, user._id);
            } else {
                result = await api.analyzeApplication(appId);
            }
            setViewingResult(result);
            setViewingAppId(appId);
            await fetchAll();
        } catch (err) {
            setError(err.message);
        } finally {
            setAnalyzing(null);
        }
    };

    const handleViewResult = (app) => {
        if (app.analysis_result) {
            setViewingResult(app.analysis_result);
            setViewingAppId(app._id);
        }
    };

    const handleDecision = async () => {
        if (!decisionModal || !decisionType) return;
        setDecidingLoading(true);
        try {
            await api.setDecision(decisionModal.appId, decisionType, decisionMsg);
            setDecisionModal(null);
            setDecisionType(null);
            setDecisionMsg("");
            await fetchAll();
        } catch (err) {
            setError(err.message);
        } finally {
            setDecidingLoading(false);
        }
    };

    // ─── Collaboration handlers ──────────────────────────────────────────

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

    // ─── Result View with Back + Approve/Reject ──────────────────────────

    if (viewingResult) {
        const currentApp = allApps.find(a => a._id === viewingAppId);
        const showDecisionBtns = currentApp && currentApp.status === "analyzed" && !currentApp.isCollab;

        return (
            <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
                <Header user={user} apiOnline={apiOnline} onLogout={onLogout} />
                <main className="container" style={{ flex: 1, padding: "2rem 2rem 4rem" }}>
                    {/* Back button */}
                    <button onClick={() => { setViewingResult(null); setViewingAppId(null); }}
                        className="btn" style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <ArrowLeft size={16} /> Back to Applications
                    </button>

                    <Step4_Results result={viewingResult} onReset={() => { setViewingResult(null); setViewingAppId(null); }} />

                    {/* Approve / Reject buttons after viewing results */}
                    {showDecisionBtns && (
                        <div className="card animate-fadeUp" style={{
                            marginTop: "2rem", padding: "1.5rem", textAlign: "center",
                            border: "2px solid var(--light-border)"
                        }}>
                            <h3 style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>Ready to make a decision?</h3>
                            <p style={{ color: "var(--warm-gray)", fontSize: "0.9rem", marginBottom: "1.25rem" }}>
                                Approve this startup to advance to the next stage, or decline.
                            </p>
                            <div style={{ display: "flex", justifyContent: "center", gap: "1rem" }}>
                                <button className="btn btn--accent"
                                    onClick={() => {
                                        setDecisionModal({ appId: viewingAppId, companyName: currentApp.company_name });
                                        setDecisionType("approved");
                                        setDecisionMsg("🎉 Congratulations! You have been selected for the next in-person pitching round. Our investment team will reach out shortly to schedule your presentation.");
                                    }}
                                    style={{ padding: "0.7rem 1.5rem", fontSize: "0.95rem" }}>
                                    <ThumbsUp size={16} /> Approve & Advance
                                </button>
                                <button className="btn"
                                    onClick={() => {
                                        setDecisionModal({ appId: viewingAppId, companyName: currentApp.company_name });
                                        setDecisionType("rejected");
                                        setDecisionMsg("Thank you for your application. After careful review, we've decided not to proceed at this time. We appreciate your effort and wish you the best.");
                                    }}
                                    style={{ padding: "0.7rem 1.5rem", fontSize: "0.95rem", color: "var(--terracotta)" }}>
                                    <ThumbsDown size={16} /> Decline
                                </button>
                            </div>
                        </div>
                    )}
                </main>

                {/* ═══ Decision Modal (inlined so it works from result view) ═══ */}
                {decisionModal && (
                    <div style={{
                        position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        zIndex: 100, backdropFilter: "blur(4px)"
                    }} onClick={() => { setDecisionModal(null); setDecisionType(null); }}>
                        <div className="card animate-scaleIn" style={{
                            width: "100%", maxWidth: 520, padding: "2rem"
                        }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
                                <h3 style={{ fontSize: "1.15rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    {decisionType === "approved"
                                        ? <><ThumbsUp size={18} color="var(--olive)" /> Approve {decisionModal.companyName}</>
                                        : <><ThumbsDown size={18} color="var(--terracotta)" /> Decline {decisionModal.companyName}</>
                                    }
                                </h3>
                                <button onClick={() => { setDecisionModal(null); setDecisionType(null); }} style={{
                                    border: "none", background: "none", cursor: "pointer", color: "var(--warm-gray)", padding: "0.25rem"
                                }}><X size={20} /></button>
                            </div>
                            <label>Message to Entrepreneur</label>
                            <textarea value={decisionMsg}
                                onChange={e => setDecisionMsg(e.target.value)}
                                rows={4}
                                style={{
                                    width: "100%", padding: "0.75rem", borderRadius: "var(--radius-sm)",
                                    border: "1px solid var(--medium-border)", fontFamily: "var(--font-body)",
                                    fontSize: "0.9rem", resize: "vertical", marginBottom: "1.25rem"
                                }}
                            />
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                                <button className="btn" onClick={() => { setDecisionModal(null); setDecisionType(null); }}>Cancel</button>
                                <button className={`btn ${decisionType === "approved" ? "btn--accent" : "btn--primary"}`}
                                    onClick={handleDecision} disabled={decidingLoading}
                                    style={{
                                        padding: "0.6rem 1.5rem",
                                        background: decisionType === "rejected" ? "var(--terracotta)" : undefined,
                                        color: decisionType === "rejected" ? "#fff" : undefined,
                                    }}>
                                    {decidingLoading ? "Sending…" : decisionType === "approved" ? "Confirm Approval" : "Confirm Decline"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ─── Invitable investors for collab modal ────────────────────────────

    const alreadyInvitedIds = collabModal
        ? [collabModal.collab.lead_investor_id, ...(collabModal.collab.collaborators || []).map(c => c.investor_id)]
        : [];
    const invitableInvestors = allInvestors.filter(inv =>
        !alreadyInvitedIds.includes(inv._id) &&
        (inv.name.toLowerCase().includes(inviteSearch.toLowerCase()) ||
            (inv.sectors || []).some(s => s.toLowerCase().includes(inviteSearch.toLowerCase())))
    );

    // ─── Main Render ─────────────────────────────────────────────────────

    return (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
            <Header user={user} apiOnline={apiOnline} onLogout={onLogout} />

            <main className="container" style={{ flex: 1, padding: "2rem 2rem 4rem" }}>
                <div className="animate-fadeUp">
                    {/* Tabs + Refresh Row */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
                        <div style={{
                            display: "flex", gap: "0.5rem",
                            background: "var(--bg-elevated)", borderRadius: "var(--radius-full)", padding: "4px"
                        }}>
                            {[
                                { key: "applications", label: "My Applications" },
                                { key: "approved", label: "Approved", icon: <ThumbsUp size={14} /> },
                                { key: "collabs", label: "Collaboration Hub", icon: <Handshake size={14} /> }
                            ].map(t => (
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
                                    {t.icon}
                                    {t.label}
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
                            <p style={{ color: "var(--warm-gray)" }}>Scraping LinkedIn, extracting profiles, running simulations…</p>
                        </div>
                    )}

                    {/* ═══ Applications Tab ═══ */}
                    {tab === "applications" && (
                        <>
                            <div style={{ marginBottom: "1.5rem" }}>
                                <h2 style={{ fontSize: "1.8rem", marginBottom: "0.3rem" }}>Startup Applications</h2>
                                <p style={{ color: "var(--warm-gray)" }}>Review and assess startups — includes your direct applications and collaboration invites.</p>
                            </div>

                            {/* 4 Stat Cards */}
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "2rem" }}>
                                <StatCard label="Total" value={totalCount} icon={<Users size={18} />} bg="var(--bg-elevated)" />
                                <StatCard label="Pending" value={pendingCount} icon={<Clock size={18} />} bg="var(--warning-bg)" />
                                <StatCard label="Analyzed" value={analyzedCount} icon={<CheckCircle size={18} />} bg="var(--success-bg)" />
                                <StatCard label="Decided" value={decidedCount} icon={<Award size={18} />} bg="var(--gold-light)" />
                            </div>

                            {loading ? (
                                <div style={{ textAlign: "center", padding: "3rem", color: "var(--warm-gray)" }}>Loading…</div>
                            ) : allApps.length === 0 ? (
                                <div className="card" style={{ textAlign: "center", padding: "3rem 2rem" }}>
                                    <FileText size={48} color="var(--light-border)" style={{ marginBottom: "1rem" }} />
                                    <p style={{ color: "var(--warm-gray)", fontSize: "1.1rem" }}>No applications yet.</p>
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                    {allApps.map((app, idx) => (
                                        <div key={`${app._id}-${idx}`} className="card" style={{ padding: "1.25rem 1.5rem" }}>
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
                                                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                                <span style={{ fontWeight: 700, fontSize: "1.05rem" }}>{app.company_name}</span>
                                                                {app.isCollab && (
                                                                    <span className="badge badge--yellow" style={{ fontSize: "0.6rem", padding: "0.1rem 0.4rem" }}>
                                                                        <Handshake size={10} /> Collab
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div style={{ fontSize: "0.8rem", color: "var(--warm-gray)" }}>
                                                                by {app.entrepreneur_name}
                                                                {app.isCollab && <> • via <strong>{app.investor_name}</strong></>}
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
                                                    <StatusBadge status={app.status} />

                                                    {(app.status === "pending") && (
                                                        <button className="btn btn--accent" onClick={() => handleAnalyze(app._id, app.isCollab, app.collabId)}
                                                            disabled={analyzing !== null}
                                                            style={{ padding: "0.5rem 1rem", fontSize: "0.82rem" }}>
                                                            <PlayCircle size={14} /> Assess
                                                        </button>
                                                    )}

                                                    {(app.status === "analyzed" || app.status === "approved" || app.status === "rejected") && (
                                                        <button className="btn" onClick={() => handleViewResult(app)}
                                                            style={{ padding: "0.5rem 1rem", fontSize: "0.82rem" }}>
                                                            <Eye size={14} /> Report
                                                        </button>
                                                    )}

                                                    {app.status === "analyzed" && !app.isCollab && (
                                                        <>
                                                            <button className="btn btn--accent"
                                                                onClick={() => {
                                                                    setDecisionModal({ appId: app._id, companyName: app.company_name });
                                                                    setDecisionType("approved");
                                                                    setDecisionMsg("🎉 Congratulations! You have been selected for the next in-person pitching round. Our investment team will reach out shortly to schedule your presentation.");
                                                                }}
                                                                style={{ padding: "0.5rem 0.85rem", fontSize: "0.82rem" }}>
                                                                <ThumbsUp size={14} /> Approve
                                                            </button>
                                                            <button className="btn"
                                                                onClick={() => {
                                                                    setDecisionModal({ appId: app._id, companyName: app.company_name });
                                                                    setDecisionType("rejected");
                                                                    setDecisionMsg("Thank you for your application. After careful review, we've decided not to proceed at this time. We wish you success in your future endeavors.");
                                                                }}
                                                                style={{ padding: "0.5rem 0.85rem", fontSize: "0.82rem", color: "var(--terracotta)" }}>
                                                                <ThumbsDown size={14} /> Decline
                                                            </button>
                                                        </>
                                                    )}

                                                    {!app.isCollab && (
                                                        <button className="btn" onClick={() => openCollabModal(app)}
                                                            style={{ padding: "0.5rem 1rem", fontSize: "0.82rem" }}>
                                                            <Handshake size={14} /> Collaborate
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Show decision message inline */}
                                            {(app.status === "approved" || app.status === "rejected") && app.decision_message && (
                                                <div style={{
                                                    marginTop: "0.75rem", padding: "0.75rem 1rem",
                                                    borderRadius: "var(--radius-sm)",
                                                    background: app.status === "approved" ? "var(--success-bg)" : "var(--danger-bg)",
                                                    fontSize: "0.85rem",
                                                    color: app.status === "approved" ? "var(--olive-dark)" : "var(--terracotta-dark)"
                                                }}>
                                                    {app.decision_message}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {/* ═══ Approved Tab ═══ */}
                    {tab === "approved" && (
                        <>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
                                <div>
                                    <h2 style={{ fontSize: "1.8rem", marginBottom: "0.15rem" }}>Approved Startups</h2>
                                    <p style={{ color: "var(--warm-gray)" }}>Startups you've approved for the next stage.</p>
                                </div>
                            </div>

                            {(() => {
                                const approvedApps = applications.filter(a => a.status === "approved");
                                if (loading) return <div style={{ textAlign: "center", padding: "3rem", color: "var(--warm-gray)" }}>Loading…</div>;
                                if (approvedApps.length === 0) return (
                                    <div className="card" style={{ textAlign: "center", padding: "3rem 2rem" }}>
                                        <ThumbsUp size={48} color="var(--light-border)" style={{ marginBottom: "1rem" }} />
                                        <p style={{ color: "var(--warm-gray)", fontSize: "1.1rem" }}>No approved startups yet.</p>
                                        <p style={{ color: "var(--warm-gray)", fontSize: "0.9rem", marginTop: "0.5rem" }}>
                                            Assess an application and approve it to see it here.
                                        </p>
                                    </div>
                                );
                                return (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                        {approvedApps.map(app => (
                                            <div key={app._id} className="card" style={{
                                                padding: "1.5rem",
                                                borderLeft: "4px solid var(--olive)"
                                            }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                                                        <div style={{
                                                            width: 44, height: 44, borderRadius: "50%",
                                                            background: "var(--success-bg)", display: "flex",
                                                            alignItems: "center", justifyContent: "center",
                                                            fontWeight: 700, fontSize: "1rem", color: "var(--olive-dark)"
                                                        }}>
                                                            {app.company_name?.charAt(0) || "?"}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{app.company_name}</div>
                                                            <div style={{ fontSize: "0.82rem", color: "var(--warm-gray)" }}>
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
                                                    <div style={{ display: "flex", gap: "0.5rem" }}>
                                                        <span className="badge badge--green" style={{ alignSelf: "center" }}>
                                                            <ThumbsUp size={12} /> Approved
                                                        </span>
                                                        {app.analysis_result && (
                                                            <button className="btn" onClick={() => handleViewResult(app)}
                                                                style={{ padding: "0.5rem 1rem", fontSize: "0.82rem" }}>
                                                                <Eye size={14} /> Report
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                {app.decision_message && (
                                                    <div style={{
                                                        marginTop: "0.85rem", padding: "0.75rem 1rem",
                                                        borderRadius: "var(--radius-sm)", background: "var(--success-bg)",
                                                        fontSize: "0.88rem", color: "var(--olive-dark)", lineHeight: 1.5
                                                    }}>
                                                        {app.decision_message}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </>
                    )}

                    {/* ═══ Collaborations Tab ═══ */}
                    {tab === "collabs" && (
                        <>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
                                <button onClick={() => setTab("applications")} className="btn"
                                    style={{ padding: "0.4rem 0.7rem", fontSize: "0.82rem" }}>
                                    <ArrowLeft size={14} />
                                </button>
                                <div>
                                    <h2 style={{ fontSize: "1.8rem", marginBottom: "0.15rem" }}>Collaboration Hub</h2>
                                    <p style={{ color: "var(--warm-gray)" }}>Deals you're collaborating on with other investors.</p>
                                </div>
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

                                        return (
                                            <div key={collab._id} className="card" style={{ padding: "1.5rem" }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                                                    <div>
                                                        <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{collab.company_name}</div>
                                                        <div style={{ fontSize: "0.82rem", color: "var(--warm-gray)", marginTop: "0.15rem" }}>
                                                            by {collab.entrepreneur_name} • Lead: <strong>{collab.lead_investor_name}</strong>
                                                        </div>
                                                        {isLead && <span className="badge badge--yellow" style={{ marginTop: "0.5rem" }}>You are lead</span>}
                                                    </div>
                                                    <div style={{ display: "flex", gap: "0.5rem" }}>
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

                {/* ═══ Decision Modal ═══ */}
                {decisionModal && (
                    <div style={{
                        position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        zIndex: 100, backdropFilter: "blur(4px)"
                    }} onClick={() => { setDecisionModal(null); setDecisionType(null); }}>
                        <div className="card animate-scaleIn" style={{
                            width: "100%", maxWidth: 520, padding: "2rem"
                        }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
                                <h3 style={{ fontSize: "1.15rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    {decisionType === "approved"
                                        ? <><ThumbsUp size={18} color="var(--olive)" /> Approve {decisionModal.companyName}</>
                                        : <><ThumbsDown size={18} color="var(--terracotta)" /> Decline {decisionModal.companyName}</>
                                    }
                                </h3>
                                <button onClick={() => { setDecisionModal(null); setDecisionType(null); }} style={{
                                    border: "none", background: "none", cursor: "pointer", color: "var(--warm-gray)", padding: "0.25rem"
                                }}><X size={20} /></button>
                            </div>

                            <label>Message to Entrepreneur</label>
                            <textarea value={decisionMsg}
                                onChange={e => setDecisionMsg(e.target.value)}
                                rows={4}
                                style={{
                                    width: "100%", padding: "0.75rem", borderRadius: "var(--radius-sm)",
                                    border: "1px solid var(--medium-border)", fontFamily: "var(--font-body)",
                                    fontSize: "0.9rem", resize: "vertical", marginBottom: "1.25rem"
                                }}
                            />

                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                                <button className="btn" onClick={() => { setDecisionModal(null); setDecisionType(null); }}>Cancel</button>
                                <button className={`btn ${decisionType === "approved" ? "btn--accent" : "btn--primary"}`}
                                    onClick={handleDecision} disabled={decidingLoading}
                                    style={{
                                        padding: "0.6rem 1.5rem",
                                        background: decisionType === "rejected" ? "var(--terracotta)" : undefined,
                                        color: decisionType === "rejected" ? "#fff" : undefined,
                                    }}>
                                    {decidingLoading ? "Sending…" : decisionType === "approved" ? "Confirm Approval" : "Confirm Decline"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

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
                        }} onClick={e => e.stopPropagation()}>
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

                            <label>Invite New Investor</label>
                            <div style={{ position: "relative", marginBottom: "0.75rem" }}>
                                <Search size={14} style={{
                                    position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
                                    color: "var(--warm-gray)"
                                }} />
                                <input type="text" placeholder="Search investors…"
                                    value={inviteSearch}
                                    onChange={e => setInviteSearch(e.target.value)}
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

/* ─── Status Badge ────────────────────────────────────────────────────────── */
function StatusBadge({ status }) {
    switch (status) {
        case "approved":
            return <span className="badge badge--green"><ThumbsUp size={11} /> Approved</span>;
        case "rejected":
            return <span className="badge" style={{ background: "var(--danger-bg)", color: "var(--terracotta-dark)" }}><ThumbsDown size={11} /> Declined</span>;
        case "analyzed":
            return <span className="badge badge--green"><CheckCircle size={12} /> Analyzed</span>;
        default:
            return <span className="badge badge--yellow"><Clock size={12} /> Pending</span>;
    }
}

/* ─── Stat Card ───────────────────────────────────────────────────────────── */
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
