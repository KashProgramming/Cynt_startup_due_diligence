import React, { useRef, useState } from "react";
import { FileText, LayoutTemplate, ChevronRight, Upload, CheckCircle2 } from "lucide-react";

export default function Step1_Upload({ files, setFiles, onNext }) {
    const handleFileChange = (e, key) => {
        if (e.target.files[0]) {
            setFiles((prev) => ({ ...prev, [key]: e.target.files[0] }));
        }
    };

    const allUploaded = Boolean(files.pitchDeck && files.financials && files.founderProfile);

    const uploadItems = [
        { id: "pitchDeck", label: "Pitch Deck", accept: ".pdf", hint: "PDF presentation", icon: LayoutTemplate, color: "var(--forest)" },
        { id: "financials", label: "Financials", accept: ".csv,.xlsx,.xls", hint: "CSV or Excel", icon: FileText, color: "var(--copper)" },
        { id: "founderProfile", label: "Founder Profile", accept: ".pdf", hint: "PDF document", icon: Upload, color: "var(--forest-lighter)" },
    ];

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
                    Step 1 of 4
                </div>
                <h2 style={{ fontSize: "2.2rem", marginBottom: "0.5rem" }}>
                    Upload Your Documents
                </h2>
                <p style={{ color: "var(--slate)", fontSize: "1.05rem", maxWidth: 500, margin: "0 auto" }}>
                    Drag & drop or click to select the required files for analysis
                </p>
            </div>

            {/* Upload Grid */}
            <div className="stagger" style={{
                display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
                gap: "1.25rem", marginBottom: "2.5rem"
            }}>
                {uploadItems.map((item, idx) => (
                    <DropZone
                        key={item.id}
                        id={item.id}
                        label={item.label}
                        accept={item.accept}
                        file={files[item.id]}
                        onChange={(e) => handleFileChange(e, item.id)}
                        Icon={item.icon}
                        hint={item.hint}
                        accentColor={item.color}
                        index={idx}
                    />
                ))}
            </div>

            {/* Progress indicator */}
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: "0.75rem", marginBottom: "2rem"
            }}>
                {uploadItems.map((item) => (
                    <div key={item.id} style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: files[item.id] ? "var(--forest)" : "var(--sand)",
                        transition: "all 0.4s var(--ease-spring)",
                        transform: files[item.id] ? "scale(1.3)" : "scale(1)"
                    }} />
                ))}
                <span style={{
                    fontSize: "0.78rem", fontWeight: 600, color: "var(--slate)",
                    marginLeft: "0.5rem"
                }}>
                    {[files.pitchDeck, files.financials, files.founderProfile].filter(Boolean).length} / 3 uploaded
                </span>
            </div>

            {/* CTA */}
            <div style={{ display: "flex", justifyContent: "center" }}>
                <button
                    className="btn btn--forest btn--lg"
                    onClick={onNext}
                    disabled={!allUploaded}
                >
                    Continue to Configuration <ChevronRight size={18} />
                </button>
            </div>
        </div>
    );
}

function DropZone({ id, label, accept, file, onChange, Icon, hint, accentColor, index }) {
    const inputRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);

    const handleClick = () => inputRef.current?.click();
    const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = () => setIsDragging(false);
    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            onChange({ target: { files: e.dataTransfer.files } });
        }
    };

    return (
        <div
            onClick={handleClick}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className="animate-fadeUp"
            style={{
                position: "relative",
                border: `2px dashed ${file ? accentColor : isDragging ? accentColor : "var(--sand)"}`,
                borderRadius: "var(--radius-lg)",
                background: file ? `${accentColor}08` : isDragging ? `${accentColor}05` : "var(--white)",
                padding: "2rem 1.25rem",
                textAlign: "center",
                cursor: "pointer",
                transition: "all 0.3s var(--ease-out)",
                display: "flex", flexDirection: "column",
                alignItems: "center", gap: "0.5rem",
                animationDelay: `${index * 0.1}s`,
                boxShadow: isDragging ? "var(--shadow-md)" : "var(--shadow-xs)",
                transform: isDragging ? "scale(1.02)" : "scale(1)",
            }}
        >
            <div style={{
                position: "relative",
                width: 52, height: 52,
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: "0.25rem"
            }}>
                <div style={{
                    position: "absolute", inset: 0,
                    borderRadius: "50%",
                    border: `2px solid ${file ? accentColor : "var(--sand)"}`,
                    transition: "all 0.4s var(--ease-spring)",
                    transform: file ? "scale(1.1)" : "scale(1)",
                    opacity: file ? 0.3 : 1
                }} />
                {file
                    ? <CheckCircle2 size={26} color={accentColor} strokeWidth={2} />
                    : <Icon size={22} color={isDragging ? accentColor : "var(--slate)"} />
                }
            </div>

            <h3 style={{
                fontSize: "0.92rem", fontFamily: "var(--font-body)",
                fontWeight: 700, color: "var(--charcoal)"
            }}>{label}</h3>

            <p style={{
                fontSize: "0.76rem", color: "var(--slate)",
                lineHeight: 1.4
            }}>
                {file ? file.name : hint}
            </p>

            <input
                type="file" accept={accept}
                ref={inputRef} onChange={onChange}
                style={{ display: "none" }} id={id}
            />
        </div>
    );
}
