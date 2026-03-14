import React, { useState, useEffect, useRef } from "react";
import {
    LogOut, Wifi, WifiOff, Upload, FileText, LayoutTemplate,
    ChevronRight, CheckCircle2, Search, Send, Clock, CheckCircle, Briefcase,
    MapPin, DollarSign, Users, Linkedin, Download, FolderOpen, ListChecks,
    Eye, ThumbsUp, ThumbsDown, Handshake, UserPlus
} from "lucide-react";
import { api } from "../api";

export default function EntrepreneurDashboard({ user, apiOnline, onLogout }) {
    const [tab, setTab] = useState("apply");
    const [investors, setInvestors] = useState([]);
    const [myApps, setMyApps] = useState([]);
    const [files, setFiles] = useState({ pitchDeck: null, financials: null, founderProfile: null });
    const [companyName, setCompanyName] = useState("");
    const [linkedinUrl, setLinkedinUrl] = useState("");
    const [selectedInvestors, setSelectedInvestors] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");
    const [dealSummary, setDealSummary] = useState(null);
    const [dealSummaryLoading, setDealSummaryLoading] = useState(false);

    useEffect(() => {
        api.getInvestors().then(setInvestors).catch(() => { });
        api.getEntrepreneurApplications(user._id).then(setMyApps).catch(() => { });
    }, [user._id]);

    const handleFileChange = (e, key) => {
        if (e.target.files[0]) {
            setFiles((prev) => ({ ...prev, [key]: e.target.files[0] }));
        }
    };

    const isLinkedinValid = /linkedin\.com\/in\//.test(linkedinUrl);
    const allReady = files.pitchDeck && files.financials && files.founderProfile && selectedInvestors.length > 0 && companyName.trim() && isLinkedinValid;

    const handleSubmit = async () => {
        if (!allReady) return;
        setSubmitting(true);
        setError("");
        setSuccess("");
        try {
            const names = [];
            for (const inv of selectedInvestors) {
                await api.submitApplication(
                    user._id, user.name, inv._id,
                    companyName, linkedinUrl,
                    files.pitchDeck, files.financials, files.founderProfile
                );
                names.push(inv.name);
            }
            setSuccess(`Applications sent to ${names.join(", ")}!`);
            setFiles({ pitchDeck: null, financials: null, founderProfile: null });
            setSelectedInvestors([]);
            setCompanyName("");
            setLinkedinUrl("");
            const apps = await api.getEntrepreneurApplications(user._id);
            setMyApps(apps);
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleViewDealSummary = async (appId) => {
        setDealSummaryLoading(true);
        setDealSummary(null);
        try {
            const summary = await api.getDealSummary(appId);
            setDealSummary(summary);
            setTab("deal");
        } catch (err) {
            setError(err.message);
        } finally {
            setDealSummaryLoading(false);
        }
    };

    const filteredInvestors = investors.filter((inv) =>
        inv.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (inv.sectors || []).some(s => s.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const navItems = [
        { key: "apply", label: "New Application", icon: <Send size={18} /> },
        { key: "status", label: "My Applications", icon: <ListChecks size={18} /> },
    ];

    // Helper to get display status from backend status
    const getStatusDisplay = (status) => {
        const s = (status || "").toUpperCase();
        if (s === "ACCEPTED") return { label: "✅ Accepted", cls: "badge--green", bgVar: "success" };
        if (s === "REJECTED") return { label: "❌ Declined", cls: "", bgVar: "danger" };
        if (s === "ANALYZED") return { label: "Analyzed", cls: "badge--green", bgVar: "success" };
        return { label: "⏳ Pending", cls: "badge--yellow", bgVar: null };
    };

    return (
        <div className="app-layout">
            {/* Sidebar */}
            <Sidebar user={user} apiOnline={apiOnline} onLogout={onLogout} navItems={navItems} tab={tab} setTab={(t) => { setTab(t); if (t !== "deal") setDealSummary(null); }} />

            <div className="main-content">
                {/* Topbar */}
                <div className="topbar">
                    <div className="topbar-title">
                        <h2>{tab === "apply" ? "Submit Application" : tab === "deal" ? "Deal Summary" : "Application Status"}</h2>
                        <p>{tab === "apply" ? "Upload documents and apply to investors" : tab === "deal" ? "Full investment status overview" : "Track your submitted applications"}</p>
                    </div>
                </div>

                <div className="content-area">
                    {tab === "apply" && (
                        <div className="animate-fadeUp">
                            {/* Company Info Card */}
                            <div className="card" style={{ marginBottom: "1.25rem" }}>
                                <div style={{
                                    display: "flex", alignItems: "center", gap: "0.6rem",
                                    marginBottom: "1.25rem", paddingBottom: "0.75rem",
                                    borderBottom: "1px solid var(--sand)"
                                }}>
                                    <div style={{
                                        width: 32, height: 32, borderRadius: "var(--radius-sm)",
                                        background: "var(--sage-light)", display: "flex",
                                        alignItems: "center", justifyContent: "center"
                                    }}>
                                        <Briefcase size={16} color="var(--forest)" />
                                    </div>
                                    <h3>Company Details</h3>
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                                    <div>
                                        <label>Company / Startup Name *</label>
                                        <input type="text" placeholder="e.g. NexaPay Technologies"
                                            value={companyName}
                                            onChange={(e) => setCompanyName(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                                            <Linkedin size={13} /> Founder LinkedIn URL *
                                        </label>
                                        <input type="url" placeholder="https://linkedin.com/in/yourprofile"
                                            value={linkedinUrl}
                                            onChange={(e) => setLinkedinUrl(e.target.value)}
                                            style={{
                                                borderColor: linkedinUrl && !isLinkedinValid ? "var(--danger)" : undefined
                                            }}
                                        />
                                        {linkedinUrl && !isLinkedinValid && (
                                            <span style={{ fontSize: "0.72rem", color: "var(--danger)", marginTop: "0.2rem", display: "block" }}>
                                                Must be a valid LinkedIn profile URL (linkedin.com/in/…)
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* File Uploads Card */}
                            <div className="card" style={{ marginBottom: "1.25rem" }}>
                                <div style={{
                                    display: "flex", justifyContent: "space-between", alignItems: "center",
                                    marginBottom: "1.25rem", paddingBottom: "0.75rem",
                                    borderBottom: "1px solid var(--sand)"
                                }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                                        <div style={{
                                            width: 32, height: 32, borderRadius: "var(--radius-sm)",
                                            background: "var(--sage-light)", display: "flex",
                                            alignItems: "center", justifyContent: "center"
                                        }}>
                                            <Upload size={16} color="var(--forest)" />
                                        </div>
                                        <h3>Upload Documents</h3>
                                    </div>
                                    <button className="btn btn--sm" onClick={() => {
                                        const csv = `Metric,Current,Projected\nAnnual Revenue,,\nMonthly Burn Rate,,\nExisting Cash on Hand,,\nTarget Raise Amount,,\nPre-Money Valuation,,\nAnnual Growth Rate,,\nTAM,,`;
                                        const blob = new Blob([csv], { type: "text/csv" });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement("a");
                                        a.href = url; a.download = "financial_template.csv";
                                        a.click(); URL.revokeObjectURL(url);
                                    }}>
                                        <Download size={13} /> CSV Template
                                    </button>
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
                                    <MiniUpload label="Pitch Deck" accept=".pdf" file={files.pitchDeck}
                                        onChange={(e) => handleFileChange(e, "pitchDeck")} Icon={LayoutTemplate} color="var(--forest)" />
                                    <MiniUpload label="Financials" accept=".csv,.xlsx,.xls" file={files.financials}
                                        onChange={(e) => handleFileChange(e, "financials")} Icon={FileText} color="var(--copper)" />
                                    <MiniUpload label="Founder Profile" accept=".pdf" file={files.founderProfile}
                                        onChange={(e) => handleFileChange(e, "founderProfile")} Icon={Upload} color="var(--forest-lighter)" />
                                </div>
                            </div>

                            {/* Investor Selection Card */}
                            <div className="card" style={{ marginBottom: "1.25rem" }}>
                                <div style={{
                                    display: "flex", justifyContent: "space-between", alignItems: "center",
                                    marginBottom: "1.25rem", paddingBottom: "0.75rem",
                                    borderBottom: "1px solid var(--sand)"
                                }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                                        <div style={{
                                            width: 32, height: 32, borderRadius: "var(--radius-sm)",
                                            background: "var(--sage-light)", display: "flex",
                                            alignItems: "center", justifyContent: "center"
                                        }}>
                                            <Users size={16} color="var(--forest)" />
                                        </div>
                                        <h3>Select Investors</h3>
                                    </div>
                                    {selectedInvestors.length > 0 && (
                                        <span className="badge badge--forest">
                                            {selectedInvestors.length} selected
                                        </span>
                                    )}
                                </div>

                                <div style={{ position: "relative", marginBottom: "1rem" }}>
                                    <Search size={16} style={{
                                        position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
                                        color: "var(--slate)"
                                    }} />
                                    <input type="text" placeholder="Search by name or sector…"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{ paddingLeft: "2.25rem" }}
                                    />
                                </div>

                                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", maxHeight: 320, overflowY: "auto" }}>
                                    {filteredInvestors.map(inv => {
                                        const isSelected = selectedInvestors.some(s => s._id === inv._id);
                                        return (
                                            <div key={inv._id} onClick={() => {
                                                setSelectedInvestors(prev =>
                                                    isSelected
                                                        ? prev.filter(s => s._id !== inv._id)
                                                        : [...prev, inv]
                                                );
                                            }}
                                                style={{
                                                    display: "flex", alignItems: "center", gap: "0.85rem",
                                                    padding: "0.85rem 1rem", borderRadius: "var(--radius-md)",
                                                    border: `2px solid ${isSelected ? "var(--forest)" : "var(--sand)"}`,
                                                    background: isSelected ? "var(--sage-light)" : "var(--white)",
                                                    cursor: "pointer", transition: "all 0.2s ease"
                                                }}>
                                                {/* Checkbox */}
                                                <div style={{
                                                    width: 20, height: 20, borderRadius: "var(--radius-xs)", flexShrink: 0,
                                                    border: `2px solid ${isSelected ? "var(--forest)" : "var(--sand)"}`,
                                                    background: isSelected ? "var(--forest)" : "transparent",
                                                    display: "flex", alignItems: "center", justifyContent: "center",
                                                    transition: "all 0.2s ease"
                                                }}>
                                                    {isSelected && <CheckCircle2 size={12} color="#fff" />}
                                                </div>
                                                {/* Avatar */}
                                                <div style={{
                                                    width: 40, height: 40, borderRadius: "var(--radius-full)",
                                                    background: "var(--cream-dark)", display: "flex",
                                                    alignItems: "center", justifyContent: "center",
                                                    fontWeight: 700, fontSize: "0.9rem", color: "var(--forest)",
                                                    flexShrink: 0, border: "1px solid var(--sand)"
                                                }}>
                                                    {inv.name.charAt(0)}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontWeight: 700, fontSize: "0.92rem" }}>{inv.name}</div>
                                                    <div style={{ fontSize: "0.76rem", color: "var(--slate)", display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.15rem" }}>
                                                        <span style={{ display: "flex", alignItems: "center", gap: "0.2rem" }}>
                                                            <Briefcase size={11} /> {inv.investor_type?.replace("_", " ")}
                                                        </span>
                                                        <span style={{ display: "flex", alignItems: "center", gap: "0.2rem" }}>
                                                            <MapPin size={11} /> {(inv.geographies || []).join(", ")}
                                                        </span>
                                                    </div>
                                                    <div style={{ fontSize: "0.7rem", color: "var(--slate)", marginTop: "0.15rem" }}>
                                                        Sectors: {(inv.sectors || []).join(", ")}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {filteredInvestors.length === 0 && (
                                        <p style={{ textAlign: "center", color: "var(--slate)", padding: "1.5rem", fontSize: "0.9rem" }}>No investors found.</p>
                                    )}
                                </div>
                            </div>

                            {/* Status Messages */}
                            {error && <div style={{ padding: "0.75rem 1rem", borderRadius: "var(--radius-md)", background: "var(--danger-bg)", border: "1px solid var(--danger-border)", color: "var(--danger)", fontSize: "0.88rem", marginBottom: "1rem", animation: "slideDown 0.3s ease" }}>{error}</div>}
                            {success && <div style={{ padding: "0.75rem 1rem", borderRadius: "var(--radius-md)", background: "var(--success-bg)", border: "1px solid var(--success-border)", color: "var(--success)", fontSize: "0.88rem", marginBottom: "1rem", animation: "slideDown 0.3s ease" }}>{success}</div>}

                            {/* Submit */}
                            <div style={{ display: "flex", justifyContent: "center", paddingTop: "0.5rem" }}>
                                <button className="btn btn--forest btn--lg" onClick={handleSubmit} disabled={!allReady || submitting}>
                                    <Send size={18} /> {submitting ? "Submitting…" : `Submit to ${selectedInvestors.length || 0} Investor${selectedInvestors.length !== 1 ? "s" : ""}`}
                                </button>
                            </div>
                        </div>
                    )}

                    {tab === "status" && (
                        <div className="animate-fadeUp">
                            {myApps.length === 0 ? (
                                <div className="card" style={{ textAlign: "center", padding: "3rem 2rem" }}>
                                    <FolderOpen size={48} color="var(--sand)" style={{ marginBottom: "1rem" }} />
                                    <p style={{ color: "var(--slate)", fontSize: "1.05rem", fontWeight: 500 }}>No applications yet.</p>
                                    <p style={{ color: "var(--slate)", fontSize: "0.88rem", marginTop: "0.5rem" }}>Submit your first application from the "New Application" tab.</p>
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                                    {myApps.map(app => {
                                        const sd = getStatusDisplay(app.status);
                                        const isDecided = ["ACCEPTED", "REJECTED"].includes((app.status || "").toUpperCase());

                                        return (
                                            <div key={app._id} className="card" style={{ padding: "1.25rem 1.5rem" }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                    <div>
                                                        <div style={{ fontWeight: 700, fontSize: "1.02rem" }}>{app.company_name}</div>
                                                        <div style={{ fontSize: "0.82rem", color: "var(--slate)", marginTop: "0.15rem" }}>
                                                            Sent to: <strong>{app.investor_name}</strong>
                                                        </div>
                                                        {app.linkedin_url && (
                                                            <div style={{ fontSize: "0.72rem", color: "var(--forest-lighter)", marginTop: "0.1rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                                                <Linkedin size={11} /> LinkedIn linked
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                        <span className={`badge ${sd.cls}`}
                                                            style={sd.bgVar === "danger" ? { background: "var(--danger-bg)", color: "var(--danger)", border: "1px solid var(--danger-border)" } : {}}>
                                                            <Clock size={11} /> {sd.label}
                                                        </span>
                                                        {isDecided && (
                                                            <button className="btn btn--sm" onClick={() => handleViewDealSummary(app._id)}>
                                                                <Eye size={13} /> Deal Summary
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Decision message from investor */}
                                                {app.decision_message && (
                                                    <div style={{
                                                        marginTop: "0.75rem", padding: "0.85rem 1rem",
                                                        borderRadius: "var(--radius-md)",
                                                        background: (app.status || "").toUpperCase() === "ACCEPTED" ? "var(--success-bg)" : "var(--danger-bg)",
                                                        border: `1px solid ${(app.status || "").toUpperCase() === "ACCEPTED" ? "var(--success-border)" : "var(--danger-border)"}`,
                                                        fontSize: "0.88rem",
                                                        color: (app.status || "").toUpperCase() === "ACCEPTED" ? "var(--success)" : "var(--danger)",
                                                        lineHeight: 1.5
                                                    }}>
                                                        {app.decision_message}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ═══ Deal Summary Tab ═══ */}
                    {tab === "deal" && (
                        <div className="animate-fadeUp">
                            {dealSummaryLoading ? (
                                <div className="card" style={{ textAlign: "center", padding: "3rem 2rem" }}>
                                    <div style={{
                                        width: 48, height: 48, margin: "0 auto 1rem",
                                        borderRadius: "50%", border: "3px solid var(--sand)",
                                        borderTopColor: "var(--forest)",
                                        animation: "rotateGeo 1s linear infinite"
                                    }} />
                                    <p style={{ color: "var(--slate)" }}>Loading deal summary…</p>
                                </div>
                            ) : dealSummary ? (
                                <>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem" }}>
                                        <button className="btn btn--sm" onClick={() => { setTab("status"); setDealSummary(null); }}>
                                            ← Back to Applications
                                        </button>
                                    </div>

                                    {/* Company Header */}
                                    <div className="card" style={{ marginBottom: "1.25rem", padding: "1.5rem", borderLeft: "4px solid var(--forest)" }}>
                                        <h3 style={{ fontSize: "1.25rem", marginBottom: "0.3rem" }}>{dealSummary.company_name}</h3>
                                        <p style={{ color: "var(--slate)", fontSize: "0.88rem" }}>Full investment deal summary</p>
                                    </div>

                                    {/* Original Investors */}
                                    <div className="card" style={{ marginBottom: "1.25rem" }}>
                                        <div style={{
                                            display: "flex", alignItems: "center", gap: "0.6rem",
                                            marginBottom: "1rem", paddingBottom: "0.75rem",
                                            borderBottom: "1px solid var(--sand)"
                                        }}>
                                            <Users size={18} color="var(--forest)" />
                                            <h3>Investors</h3>
                                        </div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                            {(dealSummary.investors || []).map((inv, i) => {
                                                const sd = getStatusDisplay(inv.status);
                                                return (
                                                    <div key={i} style={{
                                                        display: "flex", justifyContent: "space-between", alignItems: "center",
                                                        padding: "0.75rem 1rem", borderRadius: "var(--radius-md)",
                                                        background: "var(--cream-dark)", border: "1px solid var(--sand)"
                                                    }}>
                                                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                                                            <div style={{
                                                                width: 32, height: 32, borderRadius: "50%",
                                                                background: "var(--sage-light)", display: "flex",
                                                                alignItems: "center", justifyContent: "center",
                                                                fontWeight: 700, fontSize: "0.8rem", color: "var(--forest)"
                                                            }}>
                                                                {inv.investor_name?.charAt(0) || "?"}
                                                            </div>
                                                            <span style={{ fontWeight: 600, fontSize: "0.92rem" }}>{inv.investor_name}</span>
                                                        </div>
                                                        <span className={`badge ${sd.cls}`}
                                                            style={sd.bgVar === "danger" ? { background: "var(--danger-bg)", color: "var(--danger)", border: "1px solid var(--danger-border)" } : {}}>
                                                            {sd.label}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Collaborators */}
                                    {(dealSummary.collaborators || []).length > 0 && (
                                        <div className="card" style={{ marginBottom: "1.25rem" }}>
                                            <div style={{
                                                display: "flex", alignItems: "center", gap: "0.6rem",
                                                marginBottom: "1rem", paddingBottom: "0.75rem",
                                                borderBottom: "1px solid var(--sand)"
                                            }}>
                                                <Handshake size={18} color="var(--forest)" />
                                                <h3>Collaboration Invites</h3>
                                            </div>
                                            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                                {dealSummary.collaborators.map((col, i) => {
                                                    const colStatus = col.status === "COLLAB_ACCEPTED" ? { label: "✅ Accepted", cls: "badge--green" }
                                                        : col.status === "COLLAB_REJECTED" ? { label: "❌ Rejected", cls: "" }
                                                            : { label: "⏳ Invited", cls: "badge--yellow" };
                                                    return (
                                                        <div key={i} style={{
                                                            display: "flex", justifyContent: "space-between", alignItems: "center",
                                                            padding: "0.75rem 1rem", borderRadius: "var(--radius-md)",
                                                            background: "var(--cream-dark)", border: "1px solid var(--sand)"
                                                        }}>
                                                            <div>
                                                                <span style={{ fontWeight: 600, fontSize: "0.92rem" }}>{col.collaborator_investor_name}</span>
                                                                <div style={{ fontSize: "0.72rem", color: "var(--slate)", marginTop: "0.1rem" }}>
                                                                    Invited by <strong>{col.invited_by_investor_name}</strong>
                                                                </div>
                                                            </div>
                                                            <span className={`badge ${colStatus.cls}`}
                                                                style={colStatus.cls === "" ? { background: "var(--danger-bg)", color: "var(--danger)", border: "1px solid var(--danger-border)" } : {}}>
                                                                {colStatus.label}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Active Investors */}
                                    {(dealSummary.active_investors || []).length > 0 && (
                                        <div className="card" style={{ borderLeft: "4px solid var(--forest-lighter)" }}>
                                            <div style={{
                                                display: "flex", alignItems: "center", gap: "0.6rem",
                                                marginBottom: "1rem", paddingBottom: "0.75rem",
                                                borderBottom: "1px solid var(--sand)"
                                            }}>
                                                <ThumbsUp size={18} color="var(--forest)" />
                                                <h3>Active Investors in Deal</h3>
                                            </div>
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                                                {dealSummary.active_investors.map((inv, i) => (
                                                    <div key={i} style={{
                                                        display: "flex", alignItems: "center", gap: "0.5rem",
                                                        padding: "0.5rem 0.85rem", borderRadius: "var(--radius-full)",
                                                        background: "var(--success-bg)", border: "1px solid var(--success-border)",
                                                        fontSize: "0.85rem", fontWeight: 600, color: "var(--success)"
                                                    }}>
                                                        {inv.investor_name}
                                                        <span style={{ fontSize: "0.65rem", fontWeight: 400, opacity: 0.8 }}>
                                                            {inv.role === "collaborator" ? `(via ${inv.invited_by})` : "(direct)"}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="card" style={{ textAlign: "center", padding: "3rem 2rem" }}>
                                    <p style={{ color: "var(--slate)" }}>No deal summary available. Select an application to view.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ─── Shared Sidebar ──────────────────────────────────────────────────────────── */
export function Sidebar({ user, apiOnline, onLogout, navItems, tab, setTab }) {
    return (
        <aside className="sidebar">
            <div className="sidebar-brand">
                <img src="/cynt-logo.png" alt="Cynt" />
                <div className="sidebar-brand-text">
                    <h1>Cynt</h1>
                    <span>{user.role === "investor" ? "Investor Portal" : "Entrepreneur Portal"}</span>
                </div>
            </div>

            <nav className="sidebar-nav">
                {navItems.map(item => (
                    <button key={item.key}
                        className={`sidebar-nav-item ${tab === item.key ? "active" : ""}`}
                        onClick={() => setTab(item.key)}>
                        {item.icon}
                        <span>{item.label}</span>
                    </button>
                ))}
            </nav>

            <div className="sidebar-footer">
                <div className="sidebar-status">
                    <span className={`sidebar-status-dot ${apiOnline ? "online" : "offline"}`} />
                    {apiOnline ? "API Connected" : "API Offline"}
                </div>
                <div className="sidebar-user">
                    <div className="sidebar-avatar">{user.name?.charAt(0) || "?"}</div>
                    <div className="sidebar-user-info">
                        <div className="sidebar-user-name">{user.name}</div>
                        <div className="sidebar-user-role">{user.role}</div>
                    </div>
                </div>
                <button className="btn btn--ghost btn--sm" onClick={onLogout} style={{ width: "100%", justifyContent: "flex-start", color: "rgba(255,255,255,0.6)" }}>
                    <LogOut size={14} /> Sign Out
                </button>
            </div>
        </aside>
    );
}

/* ─── Mini Upload Box ─────────────────────────────────────────────────────────── */
function MiniUpload({ label, accept, file, onChange, Icon, color }) {
    const ref = useRef(null);
    return (
        <div onClick={() => ref.current?.click()} style={{
            border: `2px dashed ${file ? color : "var(--sand)"}`,
            borderRadius: "var(--radius-md)", padding: "1.25rem 0.75rem",
            textAlign: "center", cursor: "pointer",
            background: file ? `${color}08` : "var(--white)",
            transition: "all 0.2s ease",
            display: "flex", flexDirection: "column", alignItems: "center", gap: "0.3rem"
        }}>
            {file ? <CheckCircle2 size={22} color={color} /> : <Icon size={20} color="var(--slate)" />}
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--charcoal)" }}>{label}</span>
            <span style={{ fontSize: "0.7rem", color: "var(--slate)" }}>
                {file ? file.name : accept}
            </span>
            <input type="file" accept={accept} ref={ref} onChange={onChange} style={{ display: "none" }} />
        </div>
    );
}
