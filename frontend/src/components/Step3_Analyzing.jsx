import React, { useState, useEffect } from "react";

const STAGES = [
    { label: "Extracting startup profile", emoji: "📄" },
    { label: "Running financial simulation", emoji: "📊" },
    { label: "Fetching market signals", emoji: "📡" },
    { label: "Running AI agent analysis", emoji: "🤖" },
    { label: "Computing investment decision", emoji: "⚖️" },
    { label: "Generating investment memo", emoji: "📝" },
];

export default function Step3_Analyzing() {
    const [currentStage, setCurrentStage] = useState(0);
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        const stageTimer = setInterval(() => {
            setCurrentStage((prev) => (prev < STAGES.length - 1 ? prev + 1 : prev));
        }, 2500);

        const elapsedTimer = setInterval(() => {
            setElapsed((prev) => prev + 1);
        }, 1000);

        return () => { clearInterval(stageTimer); clearInterval(elapsedTimer); };
    }, []);

    const progress = ((currentStage + 1) / STAGES.length) * 100;

    return (
        <div className="animate-fadeUp" style={{
            maxWidth: 560, margin: "0 auto", textAlign: "center",
            padding: "2rem 0"
        }}>
            {/* Loader */}
            <div style={{
                position: "relative", width: 140, height: 140,
                margin: "0 auto 2.5rem"
            }}>
                {/* Outer rotating ring */}
                <svg viewBox="0 0 140 140" style={{
                    position: "absolute", inset: 0,
                    animation: "rotateGeo 8s linear infinite"
                }}>
                    <polygon
                        points="70,5 130,40 130,100 70,135 10,100 10,40"
                        fill="none" stroke="var(--sand)" strokeWidth="1.5"
                    />
                </svg>

                {/* Middle counter-rotating ring */}
                <svg viewBox="0 0 140 140" style={{
                    position: "absolute", inset: 10,
                    animation: "rotateGeo 6s linear infinite reverse",
                    width: 120, height: 120
                }}>
                    <rect x="25" y="25" width="70" height="70" rx="4"
                        fill="none" stroke="var(--sage)" strokeWidth="1.5"
                        transform="rotate(45, 60, 60)"
                    />
                </svg>

                {/* Progress Circle */}
                <svg viewBox="0 0 120 120" style={{
                    position: "absolute",
                    top: "50%", left: "50%",
                    transform: "translate(-50%, -50%) rotate(-90deg)",
                    width: 100, height: 100
                }}>
                    <circle cx="60" cy="60" r="48"
                        fill="none" stroke="var(--sand)" strokeWidth="4" />
                    <circle cx="60" cy="60" r="48"
                        fill="none" stroke="var(--forest)" strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 48}`}
                        strokeDashoffset={`${2 * Math.PI * 48 * (1 - progress / 100)}`}
                        style={{ transition: "stroke-dashoffset 0.8s var(--ease-out)" }}
                    />
                </svg>

                {/* Center percentage */}
                <div style={{
                    position: "absolute", top: "50%", left: "50%",
                    transform: "translate(-50%, -50%)",
                    fontSize: "1.8rem", fontWeight: 700,
                    fontFamily: "var(--font-heading)",
                    color: "var(--charcoal)"
                }}>
                    {Math.round(progress)}%
                </div>
            </div>

            {/* Title */}
            <h2 style={{ fontSize: "1.8rem", marginBottom: "0.4rem" }}>
                Analyzing Your Startup
            </h2>
            <p style={{
                color: "var(--slate)", marginBottom: "0.5rem",
                fontSize: "0.9rem"
            }}>
                {elapsed}s elapsed
            </p>

            {/* Current stage highlight */}
            <div style={{
                display: "inline-flex", alignItems: "center", gap: "0.5rem",
                padding: "0.5rem 1.25rem",
                borderRadius: "var(--radius-full)",
                background: "var(--sage-light)",
                border: "1px solid var(--sage-muted)",
                fontSize: "0.9rem", fontWeight: 600,
                color: "var(--forest)",
                marginBottom: "2.5rem",
                animation: "pulse 2s ease infinite"
            }}>
                <span>{STAGES[currentStage].emoji}</span>
                {STAGES[currentStage].label}...
            </div>

            {/* Pipeline Steps */}
            <div style={{
                display: "flex", flexDirection: "column", gap: "0.6rem",
                maxWidth: 360, margin: "0 auto", textAlign: "left"
            }}>
                {STAGES.map((stage, idx) => {
                    const isActive = idx === currentStage;
                    const isDone = idx < currentStage;

                    return (
                        <div key={idx} style={{
                            display: "flex", alignItems: "center", gap: "0.75rem",
                            padding: "0.5rem 0.75rem",
                            borderRadius: "var(--radius-md)",
                            background: isActive ? "var(--white)" : "transparent",
                            boxShadow: isActive ? "var(--shadow-sm)" : "none",
                            border: isActive ? "1px solid var(--sand)" : "1px solid transparent",
                            transition: "all 0.3s ease"
                        }}>
                            <div style={{
                                width: 24, height: 24, borderRadius: "50%",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "0.65rem", fontWeight: 700,
                                background: isDone ? "var(--forest-lighter)" : isActive ? "var(--forest)" : "var(--cream-dark)",
                                color: isDone || isActive ? "#fff" : "var(--slate)",
                                border: !isDone && !isActive ? "1.5px solid var(--sand)" : "none",
                                transition: "all 0.4s var(--ease-spring)"
                            }}>
                                {isDone ? "✓" : idx + 1}
                            </div>
                            <span style={{
                                fontSize: "0.85rem",
                                fontWeight: isActive ? 600 : 400,
                                color: isActive ? "var(--charcoal)" : isDone ? "var(--forest-lighter)" : "var(--slate)",
                                transition: "color 0.3s ease"
                            }}>
                                {stage.label}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
