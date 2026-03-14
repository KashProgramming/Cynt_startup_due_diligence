import React from "react";
import { ChevronLeft, Rocket } from "lucide-react";

export default function Step2_Config({ config, setConfig, onBack, onRun, error }) {
    const handleArrayChange = (e, key) => {
        const val = e.target.value;
        const arr = val.split(",").map(s => s.trim()).filter(Boolean);
        setConfig(prev => ({ ...prev, [key]: arr }));
    };

    return (
        <div className="animate-fadeUp" style={{ maxWidth: 780, margin: "0 auto" }}>
            {/* Hero */}
            <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
                <div style={{
                    display: "inline-flex", padding: "0.35rem 1rem",
                    borderRadius: "var(--radius-full)",
                    background: "var(--sage-light)", border: "1px solid var(--sage-muted)",
                    fontSize: "0.72rem", fontWeight: 700, color: "var(--forest)",
                    textTransform: "uppercase", letterSpacing: "0.1em",
                    marginBottom: "1rem"
                }}>
                    Step 2 of 4
                </div>
                <h2 style={{ fontSize: "2.2rem", marginBottom: "0.5rem" }}>
                    Portfolio Configuration
                </h2>
                <p style={{ color: "var(--slate)", fontSize: "1.05rem" }}>
                    Define your investment parameters for contextual analysis
                </p>
            </div>

            {/* Form Card */}
            <div className="card" style={{ marginBottom: "2rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
                    <div>
                        <label>Investor Type</label>
                        <select
                            value={config.investor_type}
                            onChange={(e) => setConfig({ ...config, investor_type: e.target.value })}
                        >
                            <option value="ANGEL">Angel Investor</option>
                            <option value="EARLY_VC">Early-Stage VC</option>
                            <option value="ACCELERATOR">Accelerator</option>
                            <option value="COMMITTEE">Investment Committee</option>
                        </select>
                    </div>

                    <div>
                        <label>Total Portfolio Investments</label>
                        <input
                            type="number" min="0"
                            value={config.total_investments}
                            onChange={(e) => setConfig({ ...config, total_investments: parseInt(e.target.value, 10) || 0 })}
                        />
                    </div>

                    <div style={{ gridColumn: "span 2" }}>
                        <label>Sectors <span style={{ textTransform: "none", fontWeight: 400, color: "var(--slate)" }}>(comma-separated)</span></label>
                        <input
                            type="text"
                            value={config.portfolio_sectors.join(", ")}
                            onChange={(e) => handleArrayChange(e, "portfolio_sectors")}
                            placeholder="e.g. saas, healthtech, fintech"
                        />
                    </div>

                    <div>
                        <label>Stages <span style={{ textTransform: "none", fontWeight: 400, color: "var(--slate)" }}>(comma-separated)</span></label>
                        <input
                            type="text"
                            value={config.portfolio_stages.join(", ")}
                            onChange={(e) => handleArrayChange(e, "portfolio_stages")}
                            placeholder="e.g. seed, Series A"
                        />
                    </div>

                    <div>
                        <label>Geographies <span style={{ textTransform: "none", fontWeight: 400, color: "var(--slate)" }}>(comma-separated)</span></label>
                        <input
                            type="text"
                            value={config.portfolio_geographies.join(", ")}
                            onChange={(e) => handleArrayChange(e, "portfolio_geographies")}
                            placeholder="e.g. US, Europe"
                        />
                    </div>

                    <div>
                        <label>Min Check Size (USD)</label>
                        <input
                            type="number" step="10000" min="0"
                            value={config.check_size_range_usd[0]}
                            onChange={(e) => setConfig({ ...config, check_size_range_usd: [parseFloat(e.target.value) || 0, config.check_size_range_usd[1]] })}
                        />
                    </div>

                    <div>
                        <label>Max Check Size (USD)</label>
                        <input
                            type="number" step="10000" min="0"
                            value={config.check_size_range_usd[1]}
                            onChange={(e) => setConfig({ ...config, check_size_range_usd: [config.check_size_range_usd[0], parseFloat(e.target.value) || 0] })}
                        />
                    </div>

                    <div style={{ gridColumn: "span 2", marginTop: "0.5rem" }}>
                        <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span>Max Sector Concentration</span>
                            <span style={{
                                background: "var(--sage-light)", padding: "0.2rem 0.6rem",
                                borderRadius: "var(--radius-full)", fontSize: "0.8rem",
                                fontWeight: 700, color: "var(--forest)"
                            }}>
                                {config.target_max_sector_concentration_pct}%
                            </span>
                        </label>
                        <input
                            type="range" min="5" max="100" step="5"
                            value={config.target_max_sector_concentration_pct}
                            onChange={(e) => setConfig({ ...config, target_max_sector_concentration_pct: parseFloat(e.target.value) })}
                        />
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "var(--slate)", marginTop: "0.15rem" }}>
                            <span>5%</span><span>50%</span><span>100%</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div style={{
                    padding: "0.85rem 1.25rem",
                    borderRadius: "var(--radius-md)",
                    background: "var(--danger-bg)",
                    border: "1px solid var(--danger-border)",
                    color: "var(--danger)",
                    fontSize: "0.9rem", marginBottom: "1.5rem",
                    animation: "slideDown 0.3s ease"
                }}>
                    <strong>Analysis Error:</strong> {error}
                </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                <button className="btn" onClick={onBack}>
                    <ChevronLeft size={18} /> Back
                </button>
                <button className="btn btn--forest btn--lg" onClick={onRun}>
                    <Rocket size={18} /> Launch Analysis
                </button>
            </div>
        </div>
    );
}
