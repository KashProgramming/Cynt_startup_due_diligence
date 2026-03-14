import React from "react";
import { Wifi, WifiOff } from "lucide-react";

const steps = ["Upload", "Configure", "Analyze", "Results"];

export default function WizardLayout({ currentStep, apiOnline, children }) {
    return (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--cream)" }}>
            {/* Header */}
            <header style={{
                padding: "1.15rem 0",
                background: "rgba(254, 252, 246, 0.85)",
                backdropFilter: "blur(12px)",
                borderBottom: "1px solid var(--sand)",
                position: "sticky", top: 0, zIndex: 50
            }}>
                <div style={{
                    maxWidth: 1100, margin: "0 auto", padding: "0 2rem",
                    display: "flex", justifyContent: "space-between", alignItems: "center"
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <img src="/cynt-logo.png" alt="Cynt" style={{
                            width: 36, height: 36, borderRadius: "var(--radius-sm)",
                            boxShadow: "var(--shadow-sm)", objectFit: "contain"
                        }} />
                        <div>
                            <h1 style={{
                                fontSize: "1.1rem", fontFamily: "var(--font-heading)",
                                lineHeight: 1, color: "var(--charcoal)"
                            }}>Cynt</h1>
                            <span style={{
                                fontSize: "0.6rem", fontWeight: 600,
                                textTransform: "uppercase", letterSpacing: "0.12em",
                                color: "var(--slate)"
                            }}>AI Engine</span>
                        </div>
                    </div>

                    {/* API Status */}
                    <div style={{
                        display: "flex", alignItems: "center", gap: "0.35rem",
                        padding: "0.3rem 0.75rem",
                        borderRadius: "var(--radius-full)",
                        fontSize: "0.72rem", fontWeight: 600,
                        background: apiOnline ? "var(--success-bg)" : "var(--danger-bg)",
                        color: apiOnline ? "var(--success)" : "var(--danger)",
                        border: `1px solid ${apiOnline ? "var(--success-border)" : "var(--danger-border)"}`
                    }}>
                        {apiOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
                        {apiOnline ? "Connected" : "Offline"}
                    </div>
                </div>
            </header>

            {/* Step Progress */}
            <nav style={{ padding: "2rem 2rem 0", maxWidth: 1100, margin: "0 auto", width: "100%" }}>
                <div style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    maxWidth: 520, margin: "0 auto"
                }}>
                    {steps.map((label, i) => {
                        const stepNum = i + 1;
                        const isActive = stepNum === currentStep;
                        const isDone = stepNum < currentStep;

                        return (
                            <React.Fragment key={label}>
                                <div style={{
                                    display: "flex", flexDirection: "column",
                                    alignItems: "center", gap: "0.4rem",
                                    transition: "all 0.3s ease"
                                }}>
                                    <div style={{
                                        width: 34, height: 34, borderRadius: "50%",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: "0.78rem", fontWeight: 700,
                                        background: isActive ? "var(--forest)" : isDone ? "var(--forest-lighter)" : "var(--cream-dark)",
                                        color: isActive || isDone ? "#fff" : "var(--slate)",
                                        border: isActive || isDone ? "none" : "2px solid var(--sand)",
                                        transition: "all 0.4s var(--ease-spring)",
                                        transform: isActive ? "scale(1.1)" : "scale(1)",
                                        boxShadow: isActive ? "0 4px 12px rgba(27, 67, 50, 0.2)" : "none"
                                    }}>
                                        {isDone ? "✓" : stepNum}
                                    </div>
                                    <span style={{
                                        fontSize: "0.68rem", fontWeight: isActive ? 700 : 500,
                                        color: isActive ? "var(--charcoal)" : "var(--slate)",
                                        textTransform: "uppercase", letterSpacing: "0.06em",
                                        transition: "all 0.3s ease"
                                    }}>{label}</span>
                                </div>

                                {i < steps.length - 1 && (
                                    <div style={{
                                        flex: 1, height: 2, margin: "0 0.5rem",
                                        marginBottom: "1.2rem", borderRadius: 1,
                                        background: isDone
                                            ? "linear-gradient(90deg, var(--forest-lighter), var(--sage))"
                                            : "var(--sand)",
                                        transition: "background 0.6s ease"
                                    }} />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            </nav>

            {/* Content */}
            <main style={{
                flex: 1, padding: "2rem 2rem 4rem",
                maxWidth: 1100, margin: "0 auto", width: "100%"
            }}>
                {children}
            </main>

            {/* Footer */}
            <footer style={{
                padding: "1.5rem 0",
                borderTop: "1px solid var(--sand)",
                textAlign: "center", fontSize: "0.72rem",
                color: "var(--slate)", fontWeight: 500,
                background: "rgba(254, 252, 246, 0.6)"
            }}>
                Built with AI-Powered Analysis Engine &middot; Cynt Platform
            </footer>
        </div>
    );
}
