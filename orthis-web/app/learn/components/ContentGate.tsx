"use client";

import { useState, useEffect, useRef } from "react";

interface ContentGateProps {
  children: React.ReactNode;
  threshold?: number; // 0-1, default 0.4 — gate after this fraction of content
}

/**
 * SEO-friendly content gate.
 *
 * Server renders full content (Google/crawlers see everything).
 * Client-side JS applies blur + overlay for visitors without waitlist email.
 *
 * Pattern: Medium, NYT, etc. — full content in HTML, gated in UI only.
 */
export default function ContentGate({ children, threshold = 0.4 }: ContentGateProps) {
  const [unlocked, setUnlocked] = useState(true); // start unlocked to avoid flash on SSR
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    // On client mount, check if user has already signed up
    const stored = localStorage.getItem("orthis_waitlist_email");
    if (!stored) {
      setUnlocked(false);
    }
    mountedRef.current = true;
  }, []);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok && data.error !== "Already on the list") {
        setErrorMsg(data.error || "Something went wrong.");
        setStatus("error");
        return;
      }
      // Store email and unlock content
      localStorage.setItem("orthis_waitlist_email", email.trim());
      setUnlocked(true);
      setStatus("success");

      // PostHog: track gate conversion
      try {
        const ph = (window as any).posthog;
        if (ph) {
          ph.capture("learn_waitlist_signup", { email: email.trim() });
        }
      } catch {}
    } catch {
      setErrorMsg("Network error. Please try again.");
      setStatus("error");
    }
  };

  // Apply CSS transform so the gate point is roughly at `threshold` of the content
  const gateTopPct = Math.round(threshold * 100);

  return (
    <div ref={contentRef} style={{ position: "relative" }}>
      {/* Full content — always in HTML for SEO */}
      <div
        style={{
          // Clip the blurred portion using a CSS gradient mask
          WebkitMaskImage: unlocked
            ? undefined
            : `linear-gradient(to bottom, black ${gateTopPct}%, transparent ${gateTopPct + 15}%)`,
          maskImage: unlocked
            ? undefined
            : `linear-gradient(to bottom, black ${gateTopPct}%, transparent ${gateTopPct + 15}%)`,
        }}
      >
        {children}
      </div>

      {/* Gate overlay — only shown when locked */}
      {!unlocked && (
        <div
          style={{
            position: "absolute",
            top: `${gateTopPct}%`,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            paddingTop: "40px",
            zIndex: 10,
          }}
        >
          <div
            style={{
              backgroundColor: "#FBF7F4",
              padding: "40px 32px",
              maxWidth: "480px",
              width: "100%",
              textAlign: "center",
              border: "1px solid rgba(26,26,26,0.08)",
            }}
          >
            {/* Lock icon */}
            <div style={{ fontSize: "32px", marginBottom: "16px" }}>✦</div>

            <p
              className="text-xs font-medium uppercase tracking-wider mb-3"
              style={{ color: "#E85D4C" }}
            >
              Free Early Access
            </p>

            <h3
              className="font-display mb-3"
              style={{ fontSize: "1.5rem", color: "#1A1A1A", lineHeight: 1.2 }}
            >
              Unlock the full guide
            </h3>

            <p className="text-sm mb-6" style={{ color: "rgba(45,45,45,0.6)", lineHeight: 1.6 }}>
              Join the Or This? waitlist and get access to our complete style library — free.
            </p>

            <form onSubmit={handleUnlock} className="flex flex-col gap-0">
              <div className="flex gap-0">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  disabled={status === "loading"}
                  className="flex-1 px-4 py-3 text-sm border outline-none"
                  style={{
                    borderColor: "rgba(26,26,26,0.15)",
                    backgroundColor: "#fff",
                    color: "#1A1A1A",
                  }}
                />
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="px-6 py-3 text-xs font-medium uppercase tracking-wider flex-shrink-0"
                  style={{ backgroundColor: "#E85D4C", color: "#fff" }}
                >
                  {status === "loading" ? "..." : "Unlock"}
                </button>
              </div>
              {errorMsg && (
                <p className="text-xs mt-2" style={{ color: "#EF4444" }}>
                  {errorMsg}
                </p>
              )}
            </form>

            <p className="text-xs mt-4" style={{ color: "rgba(26,26,26,0.35)" }}>
              No spam. Unsubscribe anytime.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
