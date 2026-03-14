import React, { useState, useEffect } from "react";
import {
    Eye, PlayCircle, Clock, CheckCircle, FileText, Users,
    RefreshCw, UserPlus, Handshake, X, Search, Linkedin,
    ArrowLeft, ThumbsUp, ThumbsDown, Award,
    Inbox, Mail
} from "lucide-react";
import { Sidebar } from "./EntrepreneurDashboard";
import Step4_Results from "./Step4_Results";
import { api } from "../api";

export default function InvestorDashboard({ user, apiOnline, onLogout }) {
    const [tab, setTab] = useState("applications");
    // Single unified list from backend (direct apps + collab-invite apps merged)
    const [applications, setApplications] = useState([]);
    const [collabInvites, setCollabInvites] = useState([]);   // all invites received
    const [sentInvites, setSentInvites] = useState([]);        // invites I sent
    const [hubInvites, setHubInvites] = useState([]);          // decided invites (hub)
    const [allInvestors, setAllInvestors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState(null); // appId or inviteId being analyzed
    const [viewingResult, setViewingResult] = useState(null);
    const [viewingAppId, setViewingAppId] = useState(null);
    const [error, setError] = useState("");

    // Decision modal (for direct app final decision)
    const [decisionModal, setDecisionModal] = useState(null);
    const [decisionType, setDecisionType] = useState(null);
    const [decisionMsg, setDecisionMsg] = useState("");
    const [decidingLoading, setDecidingLoading] = useState(false);

    // Invite modal — for inviting collaborators on accepted apps
    const [inviteModal, setInviteModal] = useState(null);
    const [inviteSearch, setInviteSearch] = useState("");
    const [inviting, setInviting] = useState(false);

    const fetchAll = async () => {
        setLoading(true);
        setError("");
        try {
            const [apps, investors, invites, sent, hub] = await Promise.all([
                api.getInvestorApplications(user._id),
                api.getInvestors(),
                api.getInvitesForInvestor(user._id),
                api.getSentInvites(user._id),
                api.getCollaborationHub(user._id),
            ]);
            setApplications(apps);
            setAllInvestors(investors);
            setCollabInvites(invites);
            setSentInvites(sent);
            setHubInvites(hub);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAll(); }, [user._id]);

    // ── Status normalisation ──────────────────────────────────────────────
    // For direct apps: status is backend status (pending/analyzed/ACCEPTED/REJECTED)
    // For collab-invite apps: collab_invite_status drives the "decision" layer
    //   INVITED        → invited, not yet assessed
    //   COLLAB_ASSESSED → assessed, can now accept/reject
    //   COLLAB_ACCEPTED / COLLAB_REJECTED → final

    const getAppStatus = (app) => {
        if (!app.is_collab_invite) {
            // Direct app
            const s = (app.status || "").toUpperCase();
            if (s === "ACCEPTED") return "ACCEPTED";
            if (s === "REJECTED") return "REJECTED";
            if (s === "ANALYZED") return "analyzed";
            return "pending";
        } else {
            // Collab-invite app
            const cs = (app.collab_invite_status || "").toUpperCase();
            if (cs === "COLLAB_ACCEPTED") return "COLLAB_ACCEPTED";
            if (cs === "COLLAB_REJECTED") return "COLLAB_REJECTED";
            if (cs === "COLLAB_ASSESSED") return "collab_assessed";
            return "collab_pending"; // INVITED
        }
    };

    // The "analysis_result" for display
    const getAnalysisResult = (app) => {
        if (!app.is_collab_invite) return app.analysis_result;
        return app.collab_analysis_result;
    };

    // ── Counts for stats (uses unified list) ─────────────────────────────
    const pendingApps = applications.filter(a => {
        const s = getAppStatus(a);
        return s === "pending" || s === "analyzed" || s === "collab_pending" || s === "collab_assessed";
    });
    const analyzedCount = applications.filter(a => {
        const s = getAppStatus(a);
        return s === "analyzed" || s === "collab_assessed";
    }).length;
    const decidedCount = applications.filter(a => {
        const s = getAppStatus(a);
        return s === "ACCEPTED" || s === "REJECTED" || s === "COLLAB_ACCEPTED" || s === "COLLAB_REJECTED";
    }).length;

    // ── Accepted direct apps (for invite collaborator flow) ──────────────
    const acceptedDirectApps = applications.filter(a => !a.is_collab_invite && getAppStatus(a) === "ACCEPTED");

    // ── Handlers ─────────────────────────────────────────────────────────
    const handleAnalyzeDirect = async (appId) => {
        setAnalyzing(appId);
        setError("");
        try {
            const result = await api.analyzeApplication(appId);
            setViewingResult(result);
            setViewingAppId(appId);
            await fetchAll();
        } catch (err) {
            setError(err.message);
        } finally {
            setAnalyzing(null);
        }
    };

    const handleAnalyzeCollab = async (app) => {
        const inviteId = app.collab_invite_id;
        setAnalyzing(inviteId);
        setError("");
        try {
            const result = await api.assessCollabInvite(inviteId);
            setViewingResult(result);
            setViewingAppId(app._id);
            await fetchAll();
        } catch (err) {
            setError(err.message);
        } finally {
            setAnalyzing(null);
        }
    };

    const handleViewResult = (app) => {
        const result = getAnalysisResult(app);
        if (result) {
            setViewingResult(result);
            setViewingAppId(app._id);
        }
    };

    const handleDecision = async () => {
        if (!decisionModal || !decisionType) return;
        setDecidingLoading(true);
        setError("");
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

    const handleCollabDecide = async (app, decision) => {
        setError("");
        try {
            await api.decideCollaborationInvite(app.collab_invite_id, decision);
            await fetchAll();
        } catch (err) {
            setError(err.message);
        }
    };

    const openInviteModal = (app) => {
        setInviteModal({ appId: app._id, companyName: app.company_name });
        setInviteSearch("");
    };

    const handleNewInvite = async (investor) => {
        if (!inviteModal) return;
        setInviting(true);
        setError("");
        try {
            await api.inviteCollaboratorNew(inviteModal.appId, user._id, investor._id);
            await fetchAll();
        } catch (err) {
            setError(err.message);
        } finally {
            setInviting(false);
        }
    };

    // ── Nav items ─────────────────────────────────────────────────────────
    // Invites tab: only count pending (INVITED status) received invites
    const pendingInvitesCount = collabInvites.filter(inv => inv.status === "INVITED").length;
    const navItems = [
        { key: "applications", label: "Applications", icon: <Inbox size={18} /> },
        { key: "accepted", label: "Accepted", icon: <ThumbsUp size={18} /> },
        { key: "invites", label: `Invites${pendingInvitesCount > 0 ? ` (${pendingInvitesCount})` : ""}`, icon: <Mail size={18} /> },
        { key: "hub", label: "Collaboration Hub", icon: <Handshake size={18} /> },
    ];

    // ── Result View ───────────────────────────────────────────────────────
    if (viewingResult) {
        const currentApp = applications.find(a => a._id === viewingAppId);
        const s = currentApp ? getAppStatus(currentApp) : null;

        // Show direct decision buttons if direct app and analyzed
        const showDirectDecision = currentApp && !currentApp.is_collab_invite && s === "analyzed";
        // Show collab decision buttons if collab-assessed (not yet decided)
        const showCollabDecision = currentApp && currentApp.is_collab_invite && s === "collab_assessed";

        return (
            <div className="app-layout">
                <Sidebar user={user} apiOnline={apiOnline} onLogout={onLogout} navItems={navItems} tab={tab} setTab={setTab} />
                <div className="main-content">
                    <div className="topbar">
                        <div className="topbar-title">
                            <h2>Analysis Report</h2>
                            <p>{currentApp?.company_name || "Startup Assessment"}{currentApp?.is_collab_invite && <span style={{ marginLeft: "0.5rem", fontSize: "0.78rem", color: "var(--copper)", fontWeight: 600 }}>— Your Collaboration Assessment</span>}</p>
                        </div>
                        <div className="topbar-actions">
                            <button onClick={() => { setViewingResult(null); setViewingAppId(null); }} className="btn btn--sm">
                                <ArrowLeft size={14} /> Back
                            </button>
                        </div>
                    </div>
                    <div className="content-area">
                        <Step4_Results result={viewingResult} onReset={() => { setViewingResult(null); setViewingAppId(null); }} />

                        {showDirectDecision && (
                            <div className="card animate-fadeUp" style={{ marginTop: "1.5rem", textAlign: "center", border: "2px solid var(--sand)" }}>
                                <h3 style={{ fontSize: "1.1rem", marginBottom: "0.4rem" }}>Make a decision</h3>
                                <p style={{ color: "var(--slate)", fontSize: "0.88rem", marginBottom: "1.25rem" }}>
                                    Accept this startup to advance to the next stage, or decline.
                                </p>
                                <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem" }}>
                                    <button className="btn btn--forest" onClick={() => {
                                        setDecisionModal({ appId: viewingAppId, companyName: currentApp.company_name });
                                        setDecisionType("accepted");
                                        setDecisionMsg("🎉 Congratulations! You have been selected for the next in-person pitching round. Our investment team will reach out shortly.");
                                    }}>
                                        <ThumbsUp size={16} /> Accept & Advance
                                    </button>
                                    <button className="btn btn--danger" onClick={() => {
                                        setDecisionModal({ appId: viewingAppId, companyName: currentApp.company_name });
                                        setDecisionType("rejected");
                                        setDecisionMsg("Thank you for your application. After careful review, we've decided not to proceed at this time.");
                                    }}>
                                        <ThumbsDown size={16} /> Decline
                                    </button>
                                </div>
                            </div>
                        )}

                        {showCollabDecision && (
                            <div className="card animate-fadeUp" style={{ marginTop: "1.5rem", textAlign: "center", border: "2px solid var(--sand)" }}>
                                <h3 style={{ fontSize: "1.1rem", marginBottom: "0.4rem" }}>Collaboration Decision</h3>
                                <p style={{ color: "var(--slate)", fontSize: "0.88rem", marginBottom: "1.25rem" }}>
                                    Based on your assessment, would you like to participate in this deal?
                                </p>
                                <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem" }}>
                                    <button className="btn btn--forest" onClick={() => { handleCollabDecide(currentApp, "accept"); setViewingResult(null); }}>
                                        <ThumbsUp size={16} /> Join Deal
                                    </button>
                                    <button className="btn btn--danger" onClick={() => { handleCollabDecide(currentApp, "reject"); setViewingResult(null); }}>
                                        <ThumbsDown size={16} /> Decline Invite
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                    {decisionModal && <DecisionModal {...{ decisionModal, setDecisionModal, decisionType, setDecisionType, decisionMsg, setDecisionMsg, decidingLoading, handleDecision }} />}
                </div>
            </div>
        );
    }

    // ── Invite modal: filter out already-invited investors ────────────────
    const alreadyInvitedIds = sentInvites
        .filter(inv => inv.application_id === inviteModal?.appId)
        .map(inv => inv.collaborator_investor_id);

    const invitableInvestors = allInvestors.filter(inv =>
        inv._id !== user._id &&
        !alreadyInvitedIds.includes(inv._id) &&
        (inv.name.toLowerCase().includes(inviteSearch.toLowerCase()) ||
            (inv.sectors || []).some(s => s.toLowerCase().includes(inviteSearch.toLowerCase())))
    );

    const tabTitles = {
        applications: { title: "All Applications", desc: "Your direct applications and collaboration invites you haven't decided on" },
        accepted: { title: "Accepted Startups", desc: "Startups you've accepted — invite co-investors to collaborate" },
        invites: { title: "Pending Invites", desc: "Pending collaboration invitations waiting for your assessment and decision" },
        hub: { title: "Collaboration Hub", desc: "All accepted and rejected collaboration deals — sent or received" },
    };

    return (
        <div className="app-layout">
            <Sidebar user={user} apiOnline={apiOnline} onLogout={onLogout} navItems={navItems} tab={tab} setTab={setTab} />

            <div className="main-content">
                <div className="topbar">
                    <div className="topbar-title">
                        <h2>{tabTitles[tab]?.title}</h2>
                        <p>{tabTitles[tab]?.desc}</p>
                    </div>
                    <div className="topbar-actions">
                        <button className="btn btn--sm btn--ghost" onClick={fetchAll}>
                            <RefreshCw size={14} /> Refresh
                        </button>
                    </div>
                </div>

                <div className="content-area">
                    <div className="animate-fadeUp">
                        {error && (
                            <div style={{
                                padding: "0.75rem 1rem", borderRadius: "var(--radius-md)",
                                background: "var(--danger-bg)", border: "1px solid var(--danger-border)",
                                color: "var(--danger)", fontSize: "0.88rem", marginBottom: "1rem"
                            }}>{error}</div>
                        )}

                        {analyzing && (
                            <div className="card animate-scaleIn" style={{ textAlign: "center", padding: "2.5rem", marginBottom: "1.5rem", background: "var(--cream-dark)" }}>
                                <div style={{
                                    width: 64, height: 64, margin: "0 auto 1.25rem",
                                    borderRadius: "50%", border: "3px solid var(--sand)",
                                    borderTopColor: "var(--forest)",
                                    animation: "rotateGeo 1s linear infinite"
                                }} />
                                <h3 style={{ marginBottom: "0.4rem" }}>Running AI Analysis</h3>
                                <p style={{ color: "var(--slate)", fontSize: "0.88rem" }}>Scraping LinkedIn, extracting profiles, running simulations…</p>
                            </div>
                        )}

                        {/* ═══ Applications Tab ═══ */}
                        {tab === "applications" && (
                            <>
                                {/* Stat row */}
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
                                    <StatCard label="Total" value={applications.length} icon={<Users size={18} />} bg="var(--cream-dark)" iconBg="var(--sand-light)" />
                                    <StatCard label="Pending / Active" value={pendingApps.length} icon={<Clock size={18} />} bg="var(--warning-bg)" iconBg="var(--warning-border)" />
                                    <StatCard label="Analyzed" value={analyzedCount} icon={<CheckCircle size={18} />} bg="var(--success-bg)" iconBg="var(--success-border)" />
                                    <StatCard label="Decided" value={decidedCount} icon={<Award size={18} />} bg="var(--sage-light)" iconBg="var(--sage-muted)" />
                                </div>

                                {loading ? (
                                    <div style={{ textAlign: "center", padding: "3rem", color: "var(--slate)" }}>Loading…</div>
                                ) : applications.length === 0 ? (
                                    <div className="card" style={{ textAlign: "center", padding: "3rem 2rem" }}>
                                        <FileText size={48} color="var(--sand)" style={{ marginBottom: "1rem" }} />
                                        <p style={{ color: "var(--slate)", fontSize: "1.05rem", fontWeight: 500 }}>No applications yet.</p>
                                    </div>
                                ) : (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                                        {applications.map((app, idx) => {
                                            const appStatus = getAppStatus(app);
                                            const result = getAnalysisResult(app);
                                            const isAnalyzing = analyzing === app._id || analyzing === app.collab_invite_id;
                                            return (
                                                <AppCard
                                                    key={`${app._id}-${idx}`}
                                                    app={app}
                                                    appStatus={appStatus}
                                                    hasResult={!!result}
                                                    isAnalyzing={isAnalyzing}
                                                    anyAnalyzing={analyzing !== null}
                                                    onAnalyze={() => app.is_collab_invite ? handleAnalyzeCollab(app) : handleAnalyzeDirect(app._id)}
                                                    onViewResult={() => handleViewResult(app)}
                                                    onAccept={() => {
                                                        setDecisionModal({ appId: app._id, companyName: app.company_name });
                                                        setDecisionType("accepted");
                                                        setDecisionMsg("🎉 Congratulations! You've been selected for the next round.");
                                                    }}
                                                    onReject={() => {
                                                        setDecisionModal({ appId: app._id, companyName: app.company_name });
                                                        setDecisionType("rejected");
                                                        setDecisionMsg("Thank you for your application. We've decided not to proceed at this time.");
                                                    }}
                                                    onCollabAccept={() => handleCollabDecide(app, "accept")}
                                                    onCollabReject={() => handleCollabDecide(app, "reject")}
                                                />
                                            );
                                        })}
                                    </div>
                                )}
                            </>
                        )}

                        {/* ═══ Accepted Tab ═══ */}
                        {tab === "accepted" && (
                            loading ? (
                                <div style={{ textAlign: "center", padding: "3rem", color: "var(--slate)" }}>Loading…</div>
                            ) : acceptedDirectApps.length === 0 ? (
                                <div className="card" style={{ textAlign: "center", padding: "3rem 2rem" }}>
                                    <ThumbsUp size={48} color="var(--sand)" style={{ marginBottom: "1rem" }} />
                                    <p style={{ color: "var(--slate)", fontSize: "1.05rem", fontWeight: 500 }}>No accepted startups yet.</p>
                                    <p style={{ color: "var(--slate)", fontSize: "0.88rem", marginTop: "0.4rem" }}>Assess and accept applications from the Applications tab.</p>
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                                    {acceptedDirectApps.map(app => {
                                        const appSentInvites = sentInvites.filter(inv => inv.application_id === app._id);
                                        return (
                                            <div key={app._id} className="card" style={{ padding: "1.25rem 1.35rem", borderLeft: "4px solid var(--forest-lighter)" }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.85rem" }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                                                        <div style={{
                                                            width: 42, height: 42, borderRadius: "var(--radius-full)",
                                                            background: "var(--success-bg)", display: "flex",
                                                            alignItems: "center", justifyContent: "center",
                                                            fontWeight: 700, fontSize: "1rem", color: "var(--success)",
                                                            border: "1px solid var(--success-border)"
                                                        }}>
                                                            {app.company_name?.charAt(0) || "?"}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>{app.company_name}</div>
                                                            <div style={{ fontSize: "0.8rem", color: "var(--slate)" }}>by {app.entrepreneur_name}</div>
                                                        </div>
                                                    </div>
                                                    <div style={{ display: "flex", gap: "0.5rem" }}>
                                                        <span className="badge badge--green"><ThumbsUp size={11} /> Accepted</span>
                                                        {app.analysis_result && (
                                                            <button className="btn btn--sm" onClick={() => handleViewResult(app)}><Eye size={13} /> Report</button>
                                                        )}
                                                        <button className="btn btn--forest btn--sm" onClick={() => openInviteModal(app)}>
                                                            <UserPlus size={13} /> Invite Co-Investor
                                                        </button>
                                                    </div>
                                                </div>

                                                {appSentInvites.length > 0 && (
                                                    <div style={{ marginTop: "1rem", paddingTop: "0.75rem", borderTop: "1px solid var(--sand)" }}>
                                                        <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--slate)", marginBottom: "0.5rem" }}>
                                                            Collaboration Invites
                                                        </div>
                                                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                                                            {appSentInvites.map((inv, i) => (
                                                                <div key={i} style={{
                                                                    display: "flex", alignItems: "center", gap: "0.4rem",
                                                                    padding: "0.3rem 0.7rem", borderRadius: "var(--radius-full)",
                                                                    background: "var(--cream-dark)", fontSize: "0.8rem",
                                                                    fontWeight: 600, border: "1px solid var(--sand)"
                                                                }}>
                                                                    {inv.collaborator_investor_name}
                                                                    <span className="badge" style={{
                                                                        padding: "0.1rem 0.35rem", fontSize: "0.6rem",
                                                                        background: inv.status === "COLLAB_ACCEPTED" ? "var(--success-bg)" : inv.status === "COLLAB_REJECTED" ? "var(--danger-bg)" : "var(--warning-bg)",
                                                                        color: inv.status === "COLLAB_ACCEPTED" ? "var(--success)" : inv.status === "COLLAB_REJECTED" ? "var(--danger)" : "var(--warning)",
                                                                        border: `1px solid ${inv.status === "COLLAB_ACCEPTED" ? "var(--success-border)" : inv.status === "COLLAB_REJECTED" ? "var(--danger-border)" : "var(--warning-border)"}`
                                                                    }}>
                                                                        {inv.status === "COLLAB_ACCEPTED" ? "Joined" : inv.status === "COLLAB_REJECTED" ? "Declined" : inv.status === "COLLAB_ASSESSED" ? "Assessed" : "Pending"}
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
                            )
                        )}

                        {/* ═══ Invites Tab — PENDING ONLY ═══ */}
                        {tab === "invites" && (() => {
                            const pendingOnly = collabInvites.filter(inv => inv.status === "INVITED" || inv.status === "COLLAB_ASSESSED");
                            return pendingOnly.length === 0 ? (
                                <div className="card" style={{ textAlign: "center", padding: "3rem 2rem" }}>
                                    <Mail size={48} color="var(--sand)" style={{ marginBottom: "1rem" }} />
                                    <p style={{ color: "var(--slate)", fontSize: "1.05rem", fontWeight: 500 }}>No pending invites.</p>
                                    <p style={{ color: "var(--slate)", fontSize: "0.88rem", marginTop: "0.4rem" }}>
                                        Invitations from other investors that you haven't responded to yet will appear here.
                                    </p>
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                                    {pendingOnly.map(invite => {
                                        const appEntry = applications.find(a => a.is_collab_invite && a.collab_invite_id === invite._id);
                                        const cs = (invite.status || "").toUpperCase();
                                        const isPending = cs === "INVITED";
                                        const isAssessed = cs === "COLLAB_ASSESSED";
                                        return (
                                            <div key={invite._id} className="card" style={{
                                                padding: "1.25rem 1.35rem",
                                                borderLeft: `4px solid ${isAssessed ? "var(--success)" : "var(--copper)"}`
                                            }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.85rem" }}>
                                                    <div>
                                                        <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>{invite.startup_company_name}</div>
                                                        <div style={{ fontSize: "0.8rem", color: "var(--slate)", marginTop: "0.1rem" }}>
                                                            Invited by <strong>{invite.invited_by_investor_name}</strong>
                                                        </div>
                                                    </div>
                                                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                                                        {isPending && <span className="badge badge--yellow"><Clock size={10} /> Invited — assess first</span>}
                                                        {isAssessed && <span className="badge badge--green"><CheckCircle size={10} /> Assessed — decide now</span>}

                                                        {/* Assess button */}
                                                        {(isPending || isAssessed) && appEntry && (
                                                            <button className="btn btn--forest btn--sm"
                                                                onClick={() => handleAnalyzeCollab(appEntry)}
                                                                disabled={analyzing !== null}>
                                                                <PlayCircle size={13} /> {isAssessed ? "Re-Assess" : "Assess"}
                                                            </button>
                                                        )}

                                                        {/* View report */}
                                                        {isAssessed && invite.analysis_result && (
                                                            <button className="btn btn--sm" onClick={() => {
                                                                setViewingResult(invite.analysis_result);
                                                                setViewingAppId(appEntry?._id || null);
                                                            }}>
                                                                <Eye size={13} /> Report
                                                            </button>
                                                        )}

                                                        {/* Accept / Reject — only after assessing */}
                                                        {isAssessed && (
                                                            <>
                                                                <button className="btn btn--success btn--sm"
                                                                    onClick={() => handleCollabDecide({ collab_invite_id: invite._id }, "accept")}>
                                                                    <ThumbsUp size={13} /> Join
                                                                </button>
                                                                <button className="btn btn--danger btn--sm"
                                                                    onClick={() => handleCollabDecide({ collab_invite_id: invite._id }, "reject")}>
                                                                    <ThumbsDown size={13} /> Decline
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                {isPending && (
                                                    <div style={{
                                                        marginTop: "0.65rem", padding: "0.5rem 0.85rem",
                                                        borderRadius: "var(--radius-md)",
                                                        background: "var(--warning-bg)", border: "1px solid var(--warning-border)",
                                                        fontSize: "0.8rem", color: "var(--warning)"
                                                    }}>
                                                        ⚠️ You must <strong>Assess</strong> this application before you can accept or decline.
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()}

                        {/* ═══ Collaboration Hub Tab ═══ */}
                        {tab === "hub" && (
                            hubInvites.length === 0 ? (
                                <div className="card" style={{ textAlign: "center", padding: "3rem 2rem" }}>
                                    <Handshake size={48} color="var(--sand)" style={{ marginBottom: "1rem" }} />
                                    <p style={{ color: "var(--slate)", fontSize: "1.05rem", fontWeight: 500 }}>No decided collaborations yet.</p>
                                    <p style={{ color: "var(--slate)", fontSize: "0.88rem", marginTop: "0.4rem" }}>
                                        Accepted and rejected collaboration deals (both sent and received) will appear here.
                                    </p>
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                                    {hubInvites.map(invite => {
                                        const isAccepted = invite.status === "COLLAB_ACCEPTED";
                                        const iSent = invite.invited_by_investor_id === user._id;
                                        return (
                                            <div key={invite._id} className="card" style={{
                                                padding: "1.25rem 1.35rem",
                                                borderLeft: `4px solid ${isAccepted ? "var(--forest-lighter)" : "var(--danger)"}`
                                            }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.85rem" }}>
                                                    <div>
                                                        <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>{invite.startup_company_name}</div>
                                                        <div style={{ fontSize: "0.8rem", color: "var(--slate)", marginTop: "0.15rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                                                            {iSent ? (
                                                                <span>You invited <strong>{invite.collaborator_investor_name}</strong></span>
                                                            ) : (
                                                                <span>Invited by <strong>{invite.invited_by_investor_name}</strong></span>
                                                            )}
                                                            <span style={{ color: "var(--sand)", fontSize: "0.8rem" }}>•</span>
                                                            <span className={`badge ${isAccepted ? "badge--green" : ""}`}
                                                                style={!isAccepted ? { background: "var(--danger-bg)", color: "var(--danger)", border: "1px solid var(--danger-border)" } : {}}>
                                                                {isAccepted ? <><ThumbsUp size={10} /> Accepted</> : <><ThumbsDown size={10} /> Declined</>}
                                                            </span>
                                                        </div>
                                                        {invite.decision_timestamp && (
                                                            <div style={{ fontSize: "0.7rem", color: "var(--slate)", marginTop: "0.2rem" }}>
                                                                {new Date(invite.decision_timestamp).toLocaleDateString()}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {/* Role badge */}
                                                    <span className={`badge ${iSent ? "badge--copper" : "badge--forest"}`}
                                                        style={{ fontSize: "0.7rem" }}>
                                                        {iSent ? "You Invited" : "You Were Invited"}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )
                        )}
                    </div>

                    {/* ═══ Decision Modal ═══ */}
                    {decisionModal && <DecisionModal {...{ decisionModal, setDecisionModal, decisionType, setDecisionType, decisionMsg, setDecisionMsg, decidingLoading, handleDecision }} />}

                    {/* ═══ Invite Collaborator Modal ═══ */}
                    {inviteModal && (
                        <div className="modal-overlay" onClick={() => setInviteModal(null)}>
                            <div className="modal-card" style={{ maxHeight: "80vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                                    <div>
                                        <h3 style={{ fontSize: "1.15rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                            <UserPlus size={18} color="var(--forest)" /> Invite Co-Investor — {inviteModal.companyName}
                                        </h3>
                                        <p style={{ fontSize: "0.8rem", color: "var(--slate)", marginTop: "0.2rem" }}>
                                            The invited investor will see this application in their dashboard and can assess it.
                                        </p>
                                    </div>
                                    <button onClick={() => setInviteModal(null)} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--slate)", padding: "0.25rem" }}>
                                        <X size={20} />
                                    </button>
                                </div>

                                {/* Already invited */}
                                {sentInvites.filter(inv => inv.application_id === inviteModal.appId).length > 0 && (
                                    <div style={{ marginBottom: "1.25rem" }}>
                                        <label>Already Invited</label>
                                        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                                            {sentInvites.filter(inv => inv.application_id === inviteModal.appId).map((inv, i) => (
                                                <div key={i} style={{
                                                    display: "flex", justifyContent: "space-between", alignItems: "center",
                                                    padding: "0.5rem 0.75rem", borderRadius: "var(--radius-md)", background: "var(--cream-dark)"
                                                }}>
                                                    <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>{inv.collaborator_investor_name}</span>
                                                    <span className="badge" style={{
                                                        fontSize: "0.65rem",
                                                        background: inv.status === "COLLAB_ACCEPTED" ? "var(--success-bg)" : inv.status === "COLLAB_REJECTED" ? "var(--danger-bg)" : "var(--warning-bg)",
                                                        color: inv.status === "COLLAB_ACCEPTED" ? "var(--success)" : inv.status === "COLLAB_REJECTED" ? "var(--danger)" : "var(--warning)",
                                                        border: `1px solid ${inv.status === "COLLAB_ACCEPTED" ? "var(--success-border)" : inv.status === "COLLAB_REJECTED" ? "var(--danger-border)" : "var(--warning-border)"}`
                                                    }}>
                                                        {inv.status === "COLLAB_ACCEPTED" ? "Joined" : inv.status === "COLLAB_REJECTED" ? "Declined" : inv.status === "COLLAB_ASSESSED" ? "Assessed" : "Pending"}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <label>Add New Co-Investor</label>
                                <div style={{ position: "relative", marginBottom: "0.75rem" }}>
                                    <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--slate)" }} />
                                    <input type="text" placeholder="Search investors…"
                                        value={inviteSearch} onChange={e => setInviteSearch(e.target.value)}
                                        style={{ paddingLeft: "2rem", fontSize: "0.85rem" }} />
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: 220, overflowY: "auto" }}>
                                    {invitableInvestors.map(inv => (
                                        <div key={inv._id} style={{
                                            display: "flex", justifyContent: "space-between", alignItems: "center",
                                            padding: "0.6rem 0.85rem", borderRadius: "var(--radius-md)",
                                            border: "1px solid var(--sand)", background: "var(--white)"
                                        }}>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{inv.name}</div>
                                                <div style={{ fontSize: "0.7rem", color: "var(--slate)" }}>
                                                    {inv.investor_type?.replace("_", " ")} • {(inv.sectors || []).slice(0, 3).join(", ")}
                                                </div>
                                            </div>
                                            <button className="btn btn--forest btn--sm" onClick={() => handleNewInvite(inv)} disabled={inviting}>
                                                <UserPlus size={12} /> Invite
                                            </button>
                                        </div>
                                    ))}
                                    {invitableInvestors.length === 0 && (
                                        <p style={{ textAlign: "center", color: "var(--slate)", fontSize: "0.85rem", padding: "1rem" }}>
                                            No available investors to invite.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ─── App Card ─────────────────────────────────────────────────────────────── */
function AppCard({ app, appStatus, hasResult, isAnalyzing, anyAnalyzing, onAnalyze, onViewResult, onAccept, onReject, onCollabAccept, onCollabReject }) {
    const isDirect = !app.is_collab_invite;

    // Determine what buttons to show
    const canAssess = appStatus === "pending" || appStatus === "collab_pending";
    const canReAssess = appStatus === "analyzed" || appStatus === "collab_assessed"; // already analyzed but can re-run
    const hasDecided = ["ACCEPTED", "REJECTED", "COLLAB_ACCEPTED", "COLLAB_REJECTED"].includes(appStatus);
    const canDirectDecide = isDirect && appStatus === "analyzed";
    const canCollabDecide = !isDirect && appStatus === "collab_assessed";

    return (
        <div className="card" style={{ padding: "1.15rem 1.35rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.85rem" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <div style={{
                            width: 38, height: 38, borderRadius: "var(--radius-full)",
                            background: "var(--sage-light)", display: "flex",
                            alignItems: "center", justifyContent: "center",
                            fontWeight: 700, fontSize: "0.88rem", color: "var(--forest)",
                            border: "1px solid var(--sage-muted)", flexShrink: 0
                        }}>
                            {app.company_name?.charAt(0) || "?"}
                        </div>
                        <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <span style={{ fontWeight: 700, fontSize: "1rem" }}>{app.company_name}</span>
                                {!isDirect && (
                                    <span className="badge badge--copper" style={{ fontSize: "0.58rem", padding: "0.1rem 0.4rem" }}>
                                        <Handshake size={9} /> Collab Invite
                                    </span>
                                )}
                            </div>
                            <div style={{ fontSize: "0.78rem", color: "var(--slate)" }}>
                                by {app.entrepreneur_name}
                                {!isDirect && app.collab_invited_by_name && (
                                    <> • invited by <strong>{app.collab_invited_by_name}</strong></>
                                )}
                            </div>
                            {app.linkedin_url && (
                                <a href={app.linkedin_url} target="_blank" rel="noreferrer"
                                    style={{ fontSize: "0.7rem", color: "var(--forest-lighter)", display: "flex", alignItems: "center", gap: "0.2rem", textDecoration: "none", marginTop: "0.1rem" }}>
                                    <Linkedin size={10} /> LinkedIn
                                </a>
                            )}
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                    <AppStatusBadge status={appStatus} />

                    {/* Assess/Re-assess */}
                    {(canAssess || (canReAssess && !isDirect)) && (
                        <button className="btn btn--forest btn--sm" onClick={onAnalyze}
                            disabled={anyAnalyzing || hasDecided}>
                            <PlayCircle size={13} /> {canAssess ? "Assess" : "Re-Assess"}
                        </button>
                    )}

                    {/* View report */}
                    {hasResult && (
                        <button className="btn btn--sm" onClick={onViewResult}>
                            <Eye size={13} /> Report
                        </button>
                    )}

                    {/* Direct app decision buttons */}
                    {canDirectDecide && (
                        <>
                            <button className="btn btn--success btn--sm" onClick={onAccept}>
                                <ThumbsUp size={13} /> Accept
                            </button>
                            <button className="btn btn--danger btn--sm" onClick={onReject}>
                                <ThumbsDown size={13} /> Decline
                            </button>
                        </>
                    )}

                    {/* Collab decision buttons — only after assessed */}
                    {canCollabDecide && (
                        <>
                            <button className="btn btn--success btn--sm" onClick={onCollabAccept}>
                                <ThumbsUp size={13} /> Join Deal
                            </button>
                            <button className="btn btn--danger btn--sm" onClick={onCollabReject}>
                                <ThumbsDown size={13} /> Decline
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Blocked message if collab invite and not yet assessed */}
            {!isDirect && appStatus === "collab_pending" && (
                <div style={{
                    marginTop: "0.65rem", padding: "0.5rem 0.85rem",
                    borderRadius: "var(--radius-md)",
                    background: "var(--warning-bg)", border: "1px solid var(--warning-border)",
                    fontSize: "0.8rem", color: "var(--warning)"
                }}>
                    ⚠️ You must <strong>Assess</strong> this application before you can accept or decline the collaboration invite.
                </div>
            )}

            {/* Message for decided collab */}
            {(appStatus === "COLLAB_ACCEPTED" || appStatus === "COLLAB_REJECTED") && (
                <div style={{
                    marginTop: "0.65rem", padding: "0.5rem 0.85rem",
                    borderRadius: "var(--radius-md)",
                    background: appStatus === "COLLAB_ACCEPTED" ? "var(--success-bg)" : "var(--danger-bg)",
                    border: `1px solid ${appStatus === "COLLAB_ACCEPTED" ? "var(--success-border)" : "var(--danger-border)"}`,
                    fontSize: "0.8rem",
                    color: appStatus === "COLLAB_ACCEPTED" ? "var(--success)" : "var(--danger)"
                }}>
                    {appStatus === "COLLAB_ACCEPTED" ? "✅ You have joined this deal." : "❌ You declined this collaboration."}
                </div>
            )}
        </div>
    );
}

/* ─── Status Badge ─────────────────────────────────────────────────────────── */
function AppStatusBadge({ status }) {
    switch (status) {
        case "ACCEPTED":
            return <span className="badge badge--green"><ThumbsUp size={10} /> Accepted</span>;
        case "REJECTED":
            return <span className="badge" style={{ background: "var(--danger-bg)", color: "var(--danger)", border: "1px solid var(--danger-border)" }}><ThumbsDown size={10} /> Declined</span>;
        case "analyzed":
            return <span className="badge badge--green"><CheckCircle size={11} /> Analyzed</span>;
        case "collab_assessed":
            return <span className="badge badge--green"><CheckCircle size={11} /> Assessed</span>;
        case "COLLAB_ACCEPTED":
            return <span className="badge badge--green"><ThumbsUp size={10} /> Joined</span>;
        case "COLLAB_REJECTED":
            return <span className="badge" style={{ background: "var(--danger-bg)", color: "var(--danger)", border: "1px solid var(--danger-border)" }}><ThumbsDown size={10} /> Declined</span>;
        case "collab_pending":
            return <span className="badge badge--yellow"><Clock size={11} /> Invited</span>;
        default:
            return <span className="badge badge--yellow"><Clock size={11} /> Pending</span>;
    }
}

/* ─── Decision Modal ──────────────────────────────────────────────────────── */
function DecisionModal({ decisionModal, setDecisionModal, decisionType, setDecisionType, decisionMsg, setDecisionMsg, decidingLoading, handleDecision }) {
    return (
        <div className="modal-overlay" onClick={() => { setDecisionModal(null); setDecisionType(null); }}>
            <div className="modal-card" onClick={e => e.stopPropagation()}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
                    <h3 style={{ fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        {decisionType === "accepted"
                            ? <><ThumbsUp size={18} color="var(--success)" /> Accept {decisionModal.companyName}</>
                            : <><ThumbsDown size={18} color="var(--danger)" /> Decline {decisionModal.companyName}</>}
                    </h3>
                    <button onClick={() => { setDecisionModal(null); setDecisionType(null); }} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--slate)", padding: "0.25rem" }}>
                        <X size={20} />
                    </button>
                </div>
                <label>Message to Entrepreneur</label>
                <textarea value={decisionMsg} onChange={e => setDecisionMsg(e.target.value)} rows={4}
                    style={{
                        width: "100%", padding: "0.75rem", borderRadius: "var(--radius-md)",
                        border: "1px solid var(--sand)", fontFamily: "var(--font-body)",
                        fontSize: "0.88rem", resize: "vertical", marginBottom: "1.25rem"
                    }}
                />
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.65rem" }}>
                    <button className="btn" onClick={() => { setDecisionModal(null); setDecisionType(null); }}>Cancel</button>
                    <button className={`btn ${decisionType === "accepted" ? "btn--forest" : "btn--danger"}`}
                        onClick={handleDecision} disabled={decidingLoading}>
                        {decidingLoading ? "Sending…" : decisionType === "accepted" ? "Confirm Acceptance" : "Confirm Decline"}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── Stat Card ───────────────────────────────────────────────────────────── */
function StatCard({ label, value, icon, bg, iconBg }) {
    return (
        <div className="stat-card" style={{ background: bg }}>
            <div className="stat-card-icon" style={{ background: iconBg }}>{icon}</div>
            <div>
                <div className="stat-card-value">{value}</div>
                <div className="stat-card-label">{label}</div>
            </div>
        </div>
    );
}
