import React, { useState, useEffect, useRef } from "react";
import {
    Activity, LogOut, Wifi, WifiOff, Upload, FileText, LayoutTemplate,
    ChevronRight, CheckCircle2, Search, Send, Clock, CheckCircle, Briefcase,
    MapPin, DollarSign, Users, Linkedin
} from "lucide-react";
import { api } from "../api";

export default function EntrepreneurDashboard({ user, apiOnline, onLogout }) {
    const [tab, setTab] = useState("apply");
    const [investors, setInvestors] = useState([]);
    const [myApps, setMyApps] = useState([]);
    const [files, setFiles] = useState({ pitchDeck: null, financials: null, founderProfile: null });
    const [companyName, setCompanyName] = useState("");
    const [linkedinUrl, setLinkedinUrl] = useState("");
    const [selectedInvestor, setSelectedInvestor] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");

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
    const allReady = files.pitchDeck && files.financials && files.founderProfile && selectedInvestor && companyName.trim() && isLinkedinValid;

    const handleSubmit = async () => {
        if (!allReady) return;
        setSubmitting(true);
        setError("");
        setSuccess("");
        try {
            await api.submitApplication(
                user._id, user.name, selectedInvestor._id,
                companyName, linkedinUrl,
                files.pitchDeck, files.financials, files.founderProfile
            );
            setSuccess(`Application sent to ${selectedInvestor.name}!`);
            setFiles({ pitchDeck: null, financials: null, founderProfile: null });
            setSelectedInvestor(null);
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

    const filteredInvestors = investors.filter((inv) =>
        inv.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (inv.sectors || []).some(s => s.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
            <Header user={user} apiOnline={apiOnline} onLogout={onLogout} />

            <main className="container" style={{ flex: 1, padding: "2rem 2rem 4rem" }}>
                {/* Tabs */}
                <div style={{
                    display: "flex", gap: "0.5rem", marginBottom: "2rem",
                    background: "var(--bg-elevated)", borderRadius: "var(--radius-full)",
                    padding: "4px", maxWidth: 300
                }}>
                    {[{ key: "apply", label: "Apply" }, { key: "status", label: "My Applications" }].map(t => (
                        <button key={t.key} onClick={() => setTab(t.key)} style={{
                            flex: 1, padding: "0.5rem 1rem", border: "none",
                            borderRadius: "var(--radius-full)", cursor: "pointer",
                            fontFamily: "var(--font-body)", fontSize: "0.85rem", fontWeight: 600,
                            background: tab === t.key ? "var(--bg-card)" : "transparent",
                            color: tab === t.key ? "var(--charcoal)" : "var(--warm-gray)",
                            boxShadow: tab === t.key ? "var(--shadow-sm)" : "none",
                            transition: "all 0.2s ease"
                        }}>{t.label}</button>
                    ))}
                </div>

                {tab === "apply" && (
                    <div className="animate-fadeUp">
                        <h2 style={{ fontSize: "1.8rem", marginBottom: "0.5rem" }}>Submit Your Startup</h2>
                        <p style={{ color: "var(--warm-gray)", marginBottom: "2rem" }}>
                            Upload your documents and apply to an investor for evaluation.
                        </p>

                        {/* Company Name + LinkedIn */}
                        <div className="card" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
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
                                        <Linkedin size={14} /> Founder LinkedIn URL *
                                    </label>
                                    <input type="url" placeholder="https://linkedin.com/in/yourprofile"
                                        value={linkedinUrl}
                                        onChange={(e) => setLinkedinUrl(e.target.value)}
                                        style={{
                                            borderColor: linkedinUrl && !isLinkedinValid ? "var(--terracotta)" : undefined
                                        }}
                                    />
                                    {linkedinUrl && !isLinkedinValid && (
                                        <span style={{ fontSize: "0.72rem", color: "var(--terracotta)", marginTop: "0.2rem", display: "block" }}>
                                            Must be a valid LinkedIn profile URL (linkedin.com/in/…)
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* File Uploads */}
                        <div className="card" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
                            <h3 style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>Upload Documents</h3>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
                                <MiniUpload label="Pitch Deck" accept=".pdf" file={files.pitchDeck}
                                    onChange={(e) => handleFileChange(e, "pitchDeck")} Icon={LayoutTemplate} color="var(--terracotta)" />
                                <MiniUpload label="Financials" accept=".csv,.xlsx,.xls" file={files.financials}
                                    onChange={(e) => handleFileChange(e, "financials")} Icon={FileText} color="var(--olive)" />
                                <MiniUpload label="Founder Profile" accept=".pdf" file={files.founderProfile}
                                    onChange={(e) => handleFileChange(e, "founderProfile")} Icon={Upload} color="var(--gold)" />
                            </div>
                        </div>

                        {/* Investor Selection */}
                        <div className="card" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
                            <h3 style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>Select an Investor</h3>

                            <div style={{ position: "relative", marginBottom: "1rem" }}>
                                <Search size={16} style={{
                                    position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
                                    color: "var(--warm-gray)"
                                }} />
                                <input type="text" placeholder="Search by name or sector…"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    style={{ paddingLeft: "2.25rem" }}
                                />
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxHeight: 320, overflowY: "auto" }}>
                                {filteredInvestors.map(inv => (
                                    <div key={inv._id} onClick={() => setSelectedInvestor(inv)}
                                        style={{
                                            display: "flex", alignItems: "center", gap: "1rem",
                                            padding: "1rem", borderRadius: "var(--radius-sm)",
                                            border: `2px solid ${selectedInvestor?._id === inv._id ? "var(--terracotta)" : "var(--light-border)"}`,
                                            background: selectedInvestor?._id === inv._id ? "var(--terracotta-light)" : "var(--bg-card)",
                                            cursor: "pointer", transition: "all 0.2s ease"
                                        }}>
                                        <div style={{
                                            width: 44, height: 44, borderRadius: "50%",
                                            background: "var(--bg-elevated)", display: "flex",
                                            alignItems: "center", justifyContent: "center",
                                            fontWeight: 700, fontSize: "1rem", color: "var(--charcoal)",
                                            flexShrink: 0
                                        }}>
                                            {inv.name.charAt(0)}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{inv.name}</div>
                                            <div style={{ fontSize: "0.78rem", color: "var(--warm-gray)", display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.2rem" }}>
                                                <span style={{ display: "flex", alignItems: "center", gap: "0.2rem" }}>
                                                    <Briefcase size={12} /> {inv.investor_type?.replace("_", " ")}
                                                </span>
                                                <span style={{ display: "flex", alignItems: "center", gap: "0.2rem" }}>
                                                    <MapPin size={12} /> {(inv.geographies || []).join(", ")}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: "0.72rem", color: "var(--warm-gray)", marginTop: "0.2rem" }}>
                                                Sectors: {(inv.sectors || []).join(", ")}
                                            </div>
                                        </div>
                                        {selectedInvestor?._id === inv._id && (
                                            <CheckCircle2 size={22} color="var(--terracotta)" />
                                        )}
                                    </div>
                                ))}
                                {filteredInvestors.length === 0 && (
                                    <p style={{ textAlign: "center", color: "var(--warm-gray)", padding: "1rem" }}>No investors found.</p>
                                )}
                            </div>
                        </div>

                        {/* Status Messages */}
                        {error && <div style={{ padding: "0.75rem 1rem", borderRadius: "var(--radius-sm)", background: "var(--danger-bg)", color: "var(--terracotta-dark)", fontSize: "0.9rem", marginBottom: "1rem" }}>{error}</div>}
                        {success && <div style={{ padding: "0.75rem 1rem", borderRadius: "var(--radius-sm)", background: "var(--success-bg)", color: "var(--olive-dark)", fontSize: "0.9rem", marginBottom: "1rem" }}>{success}</div>}

                        {/* Submit */}
                        <div style={{ display: "flex", justifyContent: "center" }}>
                            <button className="btn btn--accent" onClick={handleSubmit} disabled={!allReady || submitting}
                                style={{ padding: "0.85rem 2.5rem", fontSize: "1rem" }}>
                                <Send size={18} /> {submitting ? "Submitting…" : "Submit Application"}
                            </button>
                        </div>
                    </div>
                )}

                {tab === "status" && (
                    <div className="animate-fadeUp">
                        <h2 style={{ fontSize: "1.8rem", marginBottom: "0.5rem" }}>My Applications</h2>
                        <p style={{ color: "var(--warm-gray)", marginBottom: "2rem" }}>
                            Track the status of your submitted applications.
                        </p>

                        {myApps.length === 0 ? (
                            <div className="card" style={{ textAlign: "center", padding: "3rem 2rem" }}>
                                <p style={{ color: "var(--warm-gray)", fontSize: "1.1rem" }}>No applications yet.</p>
                                <p style={{ color: "var(--warm-gray)", fontSize: "0.9rem", marginTop: "0.5rem" }}>Submit your first application from the "Apply" tab.</p>
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                {myApps.map(app => (
                                    <div key={app._id} className="card" style={{ padding: "1.25rem 1.5rem" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>{app.company_name}</div>
                                                <div style={{ fontSize: "0.85rem", color: "var(--warm-gray)", marginTop: "0.2rem" }}>
                                                    Sent to: <strong>{app.investor_name}</strong>
                                                </div>
                                                {app.linkedin_url && (
                                                    <div style={{ fontSize: "0.75rem", color: "var(--olive)", marginTop: "0.15rem", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                                                        <Linkedin size={11} /> LinkedIn linked
                                                    </div>
                                                )}
                                            </div>
                                            <span className={`badge ${app.status === "analyzed" ? "badge--green" : "badge--yellow"}`}>
                                                {app.status === "analyzed" ? <><CheckCircle size={12} /> Analyzed</> : <><Clock size={12} /> Pending</>}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}

/* ─── Shared Header ──────────────────────────────────────────────────────────── */
export function Header({ user, apiOnline, onLogout }) {
    return (
        <header style={{
            padding: "1rem 0", background: "rgba(250,247,242,0.85)",
            backdropFilter: "blur(12px)", borderBottom: "1px solid var(--light-border)",
            position: "sticky", top: 0, zIndex: 50
        }}>
            <div className="container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: "var(--radius-sm)",
                        background: "var(--charcoal)", display: "flex",
                        alignItems: "center", justifyContent: "center"
                    }}>
                        <Activity size={18} color="#FAF7F2" />
                    </div>
                    <div>
                        <h1 style={{ fontSize: "1rem", fontFamily: "var(--font-display)", lineHeight: 1 }}>Due Diligence</h1>
                        <span style={{ fontSize: "0.6rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--warm-gray)" }}>
                            {user.role === "investor" ? "Investor Portal" : "Entrepreneur Portal"}
                        </span>
                    </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--charcoal)" }}>
                        {user.name}
                    </span>
                    <div style={{
                        display: "flex", alignItems: "center", gap: "0.3rem",
                        fontSize: "0.72rem", fontWeight: 600,
                        color: apiOnline ? "var(--olive)" : "var(--terracotta)"
                    }}>
                        {apiOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
                    </div>
                    <button onClick={onLogout} className="btn" style={{
                        padding: "0.4rem 0.85rem", fontSize: "0.8rem"
                    }}>
                        <LogOut size={14} /> Logout
                    </button>
                </div>
            </div>
        </header>
    );
}

/* ─── Mini Upload Box ─────────────────────────────────────────────────────────── */
function MiniUpload({ label, accept, file, onChange, Icon, color }) {
    const ref = useRef(null);
    return (
        <div onClick={() => ref.current?.click()} style={{
            border: `2px dashed ${file ? color : "var(--medium-border)"}`,
            borderRadius: "var(--radius-sm)", padding: "1.25rem 0.75rem",
            textAlign: "center", cursor: "pointer",
            background: file ? `${color}08` : "var(--bg-card)",
            transition: "all 0.2s ease",
            display: "flex", flexDirection: "column", alignItems: "center", gap: "0.3rem"
        }}>
            {file ? <CheckCircle2 size={22} color={color} /> : <Icon size={20} color="var(--warm-gray)" />}
            <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>{label}</span>
            <span style={{ fontSize: "0.7rem", color: "var(--warm-gray)" }}>
                {file ? file.name : accept}
            </span>
            <input type="file" accept={accept} ref={ref} onChange={onChange} style={{ display: "none" }} />
        </div>
    );
}
