"use client";

import { useState, useRef, useCallback } from "react";
import WebScoreCard from "../components/WebScoreCard";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://fitcheck-production-0f92.up.railway.app";

const APP_STORE_URL = "https://apps.apple.com/app/or-this/id6742406265";

const OCCASIONS = ["Work", "Date Night", "Casual", "Interview", "Event", "Weekend"] as const;
type Occasion = (typeof OCCASIONS)[number];

interface CheckResult {
  score: number;
  whatsWorking: string[];
  occasion: string;
}

export default function OutfitScorer() {
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedOccasion, setSelectedOccasion] = useState<Occasion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (JPEG, PNG, or WEBP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5MB.");
      return;
    }
    setError(null);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImageBase64(dataUrl);
      setImagePreview(dataUrl);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleSubmit = async () => {
    if (!imageBase64 || !selectedOccasion) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/web-check/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, occasions: [selectedOccasion] }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      setResult(data as CheckResult);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setImageBase64(null);
    setImagePreview(null);
    setSelectedOccasion(null);
    setResult(null);
    setError(null);
  };

  const canSubmit = imageBase64 && selectedOccasion && !isLoading;

  return (
    <>
      {!result ? (
        <>
          {/* Image Upload */}
          <div style={{ marginBottom: "28px" }}>
            <div
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "1.5px",
                color: "rgba(26,26,26,0.5)",
                marginBottom: "12px",
              }}
            >
              Your Outfit
            </div>
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => !imagePreview && fileInputRef.current?.click()}
              style={{
                border: `1px solid ${isDragging ? "#E85D4C" : "rgba(26,26,26,0.15)"}`,
                background: isDragging ? "rgba(232,93,76,0.04)" : imagePreview ? "#000" : "#fff",
                minHeight: imagePreview ? "auto" : "180px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: imagePreview ? "default" : "pointer",
                position: "relative",
                overflow: "hidden",
                transition: "border-color 0.15s",
              }}
            >
              {imagePreview ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreview}
                    alt="Your outfit"
                    style={{ width: "100%", maxHeight: "400px", objectFit: "contain", display: "block" }}
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); handleReset(); }}
                    style={{
                      position: "absolute",
                      top: "8px",
                      right: "8px",
                      background: "rgba(0,0,0,0.6)",
                      color: "#fff",
                      border: "none",
                      padding: "4px 10px",
                      cursor: "pointer",
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "11px",
                      textTransform: "uppercase",
                      letterSpacing: "0.8px",
                    }}
                  >
                    Change
                  </button>
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "32px" }}>
                  <div style={{ fontSize: "32px", marginBottom: "12px" }}>↑</div>
                  <div
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "14px",
                      color: "rgba(26,26,26,0.5)",
                      marginBottom: "4px",
                    }}
                  >
                    Drag and drop, or click to upload
                  </div>
                  <div
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "11px",
                      color: "rgba(26,26,26,0.35)",
                    }}
                  >
                    JPEG, PNG or WEBP · max 5MB
                  </div>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </div>

          {/* Occasion Picker */}
          <div style={{ marginBottom: "32px" }}>
            <div
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "1.5px",
                color: "rgba(26,26,26,0.5)",
                marginBottom: "12px",
              }}
            >
              Occasion
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {OCCASIONS.map((occ) => (
                <button
                  key={occ}
                  onClick={() => setSelectedOccasion(occ)}
                  style={{
                    padding: "8px 16px",
                    border: `1px solid ${selectedOccasion === occ ? "#E85D4C" : "rgba(26,26,26,0.2)"}`,
                    background: selectedOccasion === occ ? "#E85D4C" : "transparent",
                    color: selectedOccasion === occ ? "#fff" : "#1A1A1A",
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "13px",
                    fontWeight: 500,
                    textTransform: "uppercase",
                    letterSpacing: "0.8px",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    borderRadius: 0,
                  }}
                >
                  {occ}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "14px",
                color: "#EF4444",
                marginBottom: "16px",
                padding: "12px",
                border: "1px solid rgba(239,68,68,0.2)",
                background: "rgba(239,68,68,0.04)",
              }}
            >
              {error}
            </div>
          )}

          {/* CTA */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              width: "100%",
              padding: "18px",
              background: canSubmit ? "#E85D4C" : "rgba(26,26,26,0.12)",
              color: canSubmit ? "#fff" : "rgba(26,26,26,0.4)",
              border: "none",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "14px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "1.5px",
              cursor: canSubmit ? "pointer" : "not-allowed",
              borderRadius: 0,
              transition: "background 0.15s",
            }}
          >
            {isLoading ? "Analyzing…" : "Get My Score"}
          </button>
        </>
      ) : (
        <>
          {/* Results */}
          <WebScoreCard
            score={result.score}
            whatsWorking={result.whatsWorking}
            occasion={result.occasion}
          />

          {/* Blurred full analysis teaser */}
          <div
            style={{
              marginTop: "24px",
              border: "1px solid rgba(26,26,26,0.1)",
              background: "#fff",
              padding: "24px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div style={{ filter: "blur(6px)", userSelect: "none", pointerEvents: "none" }}>
              <div
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "1.5px",
                  color: "rgba(26,26,26,0.5)",
                  marginBottom: "12px",
                }}
              >
                Quick Fixes
              </div>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "15px", color: "#1A1A1A", margin: "0 0 8px" }}>
                Swap the belt for a thinner one in a matching tone.
              </p>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "15px", color: "#1A1A1A", margin: 0 }}>
                Add a structured bag to elevate the overall look.
              </p>
            </div>

            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(251,247,244,0.7)",
                backdropFilter: "blur(2px)",
                padding: "24px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontStyle: "italic",
                  fontSize: "18px",
                  color: "#1A1A1A",
                  marginBottom: "8px",
                }}
              >
                Get the full breakdown.
              </div>
              <div
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "13px",
                  color: "rgba(26,26,26,0.6)",
                  marginBottom: "20px",
                }}
              >
                Quick fixes, follow-up questions, and your Style DNA — in the app.
              </div>
              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: "#E85D4C",
                  color: "#fff",
                  padding: "14px 32px",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "13px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "1.2px",
                  textDecoration: "none",
                  display: "inline-block",
                  borderRadius: 0,
                }}
              >
                Download Or This?
              </a>
            </div>
          </div>

          {/* Try again */}
          <button
            onClick={handleReset}
            style={{
              marginTop: "16px",
              width: "100%",
              padding: "14px",
              background: "transparent",
              color: "rgba(26,26,26,0.6)",
              border: "1px solid rgba(26,26,26,0.2)",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "13px",
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "1px",
              cursor: "pointer",
              borderRadius: 0,
            }}
          >
            Score Another Outfit
          </button>
        </>
      )}

      <p
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: "12px",
          color: "rgba(26,26,26,0.4)",
          textAlign: "center",
          marginTop: "32px",
        }}
      >
        3 free checks per day · No account required
      </p>
    </>
  );
}
