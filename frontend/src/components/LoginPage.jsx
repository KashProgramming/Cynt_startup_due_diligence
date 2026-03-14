import React, { useState } from "react";
import { LogIn, UserPlus, Mail, Lock, User, Briefcase, ChevronRight, Eye, EyeOff } from "lucide-react";
import { api } from "../api";

export default function LoginPage({ onLogin, apiOnline }) {
    const [mode, setMode] = useState("login"); // "login" | "register"
    const [role, setRole] = useState("entrepreneur");
    const [form, setForm] = useState({ email: "", password: "", name: "" });
    const [showPassword, setShowPassword] = useState(false);
    const [investorFields, setInvestorFields] = useState({
        investor_type: "EARLY_VC",
        sectors: "fintech, saas",
        stages: "seed, Series A",
        geographies: "India, US",
        check_size_min: 100000,
        check_size_max: 1000000,
        total_investments: 0,
        max_sector_concentration_pct: 30,
    });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            if (mode === "login") {
                const user = await api.login(form.email, form.password);
                onLogin(user);
            } else {
                const data = {
                    email: form.email,
                    password: form.password,
                    name: form.name,
                    role,
                };
                if (role === "investor") {
                    data.investor_type = investorFields.investor_type;
                    data.sectors = investorFields.sectors.split(",").map(s => s.trim()).filter(Boolean);
                    data.stages = investorFields.stages.split(",").map(s => s.trim()).filter(Boolean);
                    data.geographies = investorFields.geographies.split(",").map(s => s.trim()).filter(Boolean);
                    data.check_size_range_usd = [Number(investorFields.check_size_min), Number(investorFields.check_size_max)];
                    data.total_investments = Number(investorFields.total_investments);
                    data.max_sector_concentration_pct = Number(investorFields.max_sector_concentration_pct);
                }
                const user = await api.register(data);
                onLogin(user);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: "100vh", display: "flex",
            background: "var(--cream)"
        }}>
            {/* Left Branded Panel */}
            <div style={{
                width: "45%", minHeight: "100vh",
                background: "var(--forest)",
                display: "flex", flexDirection: "column",
                justifyContent: "center", alignItems: "center",
                padding: "3rem",
                position: "relative", overflow: "hidden"
            }}>
                {/* Decorative elements */}
                <div style={{
                    position: "absolute", top: -80, right: -80,
                    width: 260, height: 260, borderRadius: "50%",
                    background: "rgba(149, 213, 178, 0.06)",
                    pointerEvents: "none"
                }} />
                <div style={{
                    position: "absolute", bottom: -100, left: -60,
                    width: 320, height: 320, borderRadius: "50%",
                    background: "rgba(149, 213, 178, 0.04)",
                    pointerEvents: "none"
                }} />
                <div style={{
                    position: "absolute", top: "30%", left: "10%",
                    width: 120, height: 120, borderRadius: "50%",
                    border: "1px solid rgba(149, 213, 178, 0.08)",
                    pointerEvents: "none"
                }} />

                <div style={{ position: "relative", zIndex: 1, textAlign: "center", maxWidth: 380 }}>
                    <img src="/cynt-logo.png" alt="Cynt" style={{
                        width: 64, height: 64, borderRadius: "var(--radius-lg)",
                        boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
                        marginBottom: "1.75rem", objectFit: "contain"
                    }} />

                    <h1 style={{
                        fontFamily: "var(--font-heading)", fontSize: "2.5rem",
                        color: "#fff", fontWeight: 700, marginBottom: "0.75rem",
                        lineHeight: 1.1
                    }}>Cynt</h1>

                    <p style={{
                        color: "var(--sage)", fontSize: "1.05rem",
                        lineHeight: 1.6, marginBottom: "2.5rem", opacity: 0.9
                    }}>
                        AI-Powered Investment Intelligence for smarter due diligence decisions
                    </p>

                    {/* Feature bullets */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", textAlign: "left" }}>
                        {[
                            "Automated startup analysis & scoring",
                            "Financial risk simulation engine",
                            "Real-time market validation signals",
                            "Collaborative investor assessment"
                        ].map((feat, i) => (
                            <div key={i} style={{
                                display: "flex", alignItems: "center", gap: "0.75rem",
                                color: "rgba(255,255,255,0.75)", fontSize: "0.88rem"
                            }}>
                                <div style={{
                                    width: 6, height: 6, borderRadius: "50%",
                                    background: "var(--sage)", flexShrink: 0
                                }} />
                                {feat}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Form Panel */}
            <div style={{
                flex: 1, display: "flex", alignItems: "center",
                justifyContent: "center", padding: "2rem"
            }}>
                <div className="animate-fadeUp" style={{ width: "100%", maxWidth: 440 }}>
                    {/* Mode Toggle */}
                    <div style={{
                        display: "flex", background: "var(--cream-dark)",
                        borderRadius: "var(--radius-md)", padding: "3px",
                        marginBottom: "2rem", border: "1px solid var(--sand)"
                    }}>
                        {["login", "register"].map((m) => (
                            <button key={m} onClick={() => { setMode(m); setError(""); }}
                                style={{
                                    flex: 1, padding: "0.6rem", border: "none",
                                    borderRadius: "var(--radius-sm)", cursor: "pointer",
                                    fontFamily: "var(--font-body)", fontSize: "0.85rem", fontWeight: 600,
                                    background: mode === m ? "var(--white)" : "transparent",
                                    color: mode === m ? "var(--charcoal)" : "var(--slate)",
                                    boxShadow: mode === m ? "var(--shadow-sm)" : "none",
                                    transition: "all 0.2s ease",
                                    display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem"
                                }}>
                                {m === "login" ? <><LogIn size={14} /> Sign In</> : <><UserPlus size={14} /> Register</>}
                            </button>
                        ))}
                    </div>

                    {/* Welcome text */}
                    <div style={{ marginBottom: "1.75rem" }}>
                        <h2 style={{ fontSize: "1.6rem", marginBottom: "0.35rem" }}>
                            {mode === "login" ? "Welcome back" : "Create your account"}
                        </h2>
                        <p style={{ color: "var(--slate)", fontSize: "0.9rem" }}>
                            {mode === "login" ? "Sign in to access your dashboard" : "Join the platform as an entrepreneur or investor"}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit}>
                        {/* Role Selector (register only) */}
                        {mode === "register" && (
                            <div style={{ marginBottom: "1.25rem" }}>
                                <label>I am a</label>
                                <div style={{ display: "flex", gap: "0.75rem" }}>
                                    {["entrepreneur", "investor"].map((r) => (
                                        <button key={r} type="button" onClick={() => setRole(r)}
                                            style={{
                                                flex: 1, padding: "0.65rem",
                                                border: `2px solid ${role === r ? "var(--forest)" : "var(--sand)"}`,
                                                borderRadius: "var(--radius-md)",
                                                background: role === r ? "var(--sage-light)" : "var(--white)",
                                                color: role === r ? "var(--forest)" : "var(--slate)",
                                                cursor: "pointer", fontFamily: "var(--font-body)",
                                                fontSize: "0.88rem", fontWeight: 600,
                                                transition: "all 0.2s ease",
                                                textTransform: "capitalize", display: "flex",
                                                alignItems: "center", justifyContent: "center", gap: "0.4rem"
                                            }}>
                                            {r === "entrepreneur" ? <Briefcase size={16} /> : <User size={16} />}
                                            {r}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {mode === "register" && (
                            <div style={{ marginBottom: "1rem" }}>
                                <label>Full Name</label>
                                <input type="text" placeholder="John Doe"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    required
                                />
                            </div>
                        )}

                        <div style={{ marginBottom: "1rem" }}>
                            <label>Email</label>
                            <input type="email" placeholder="you@company.com"
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                required
                            />
                        </div>

                        <div style={{ marginBottom: "1.25rem" }}>
                            <label>Password</label>
                            <div style={{ position: "relative" }}>
                                <input type={showPassword ? "text" : "password"} placeholder="••••••••"
                                    value={form.password}
                                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                                    required
                                    style={{ paddingRight: "2.5rem" }}
                                />
                                <button type="button" onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                                        border: "none", background: "none", cursor: "pointer",
                                        color: "var(--slate)", padding: "0.2rem"
                                    }}>
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        {/* Investor-specific fields */}
                        {mode === "register" && role === "investor" && (
                            <div style={{
                                padding: "1.25rem", background: "var(--cream-dark)",
                                borderRadius: "var(--radius-md)", marginBottom: "1.25rem",
                                border: "1px solid var(--sand)"
                            }}>
                                <p style={{
                                    fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase",
                                    letterSpacing: "0.1em", color: "var(--forest)", marginBottom: "1rem"
                                }}>
                                    Investor Profile
                                </p>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                                    <div>
                                        <label>Investor Type</label>
                                        <select value={investorFields.investor_type}
                                            onChange={(e) => setInvestorFields({ ...investorFields, investor_type: e.target.value })}>
                                            <option value="ANGEL">Angel</option>
                                            <option value="EARLY_VC">Early VC</option>
                                            <option value="ACCELERATOR">Accelerator</option>
                                            <option value="COMMITTEE">Committee</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label>Total Investments</label>
                                        <input type="number" min="0"
                                            value={investorFields.total_investments}
                                            onChange={(e) => setInvestorFields({ ...investorFields, total_investments: e.target.value })}
                                        />
                                    </div>
                                    <div style={{ gridColumn: "span 2" }}>
                                        <label>Sectors (comma-separated)</label>
                                        <input type="text" value={investorFields.sectors}
                                            onChange={(e) => setInvestorFields({ ...investorFields, sectors: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label>Stages</label>
                                        <input type="text" value={investorFields.stages}
                                            onChange={(e) => setInvestorFields({ ...investorFields, stages: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label>Geographies</label>
                                        <input type="text" value={investorFields.geographies}
                                            onChange={(e) => setInvestorFields({ ...investorFields, geographies: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {error && (
                            <div style={{
                                padding: "0.65rem 1rem", marginBottom: "1rem",
                                borderRadius: "var(--radius-md)",
                                background: "var(--danger-bg)", border: "1px solid var(--danger-border)",
                                color: "var(--danger)", fontSize: "0.85rem",
                                animation: "slideDown 0.3s ease"
                            }}>{error}</div>
                        )}

                        <button type="submit" className="btn btn--forest btn--lg"
                            disabled={loading}
                            style={{ width: "100%", fontSize: "0.95rem" }}>
                            {loading ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
                            {!loading && <ChevronRight size={18} />}
                        </button>
                    </form>

                    {/* API Status */}
                    <div style={{
                        textAlign: "center", marginTop: "2rem",
                        fontSize: "0.72rem", color: "var(--slate)"
                    }}>
                        <span style={{
                            display: "inline-flex", alignItems: "center", gap: "0.35rem",
                            padding: "0.3rem 0.75rem",
                            borderRadius: "var(--radius-full)",
                            background: apiOnline ? "var(--success-bg)" : "var(--danger-bg)",
                            border: `1px solid ${apiOnline ? "var(--success-border)" : "var(--danger-border)"}`,
                            color: apiOnline ? "var(--success)" : "var(--danger)",
                            fontWeight: 600
                        }}>
                            <span style={{
                                width: 6, height: 6, borderRadius: "50%",
                                background: apiOnline ? "var(--success)" : "var(--danger)"
                            }} />
                            {apiOnline ? "API Connected" : "API Offline"}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
