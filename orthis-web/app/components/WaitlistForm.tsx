"use client";

import { useState, useEffect } from "react";
import posthog from "posthog-js";

export default function WaitlistForm({
  refCode,
  variant = "light",
}: {
  refCode: string;
  variant?: "light" | "dark";
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState<{
    position: number;
    referralCode: string;
    referralLink: string;
    alreadyJoined?: boolean;
    referralCount?: number;
    currentTier?: { count: number; label: string; description: string } | null;
    nextTier?: { count: number; label: string; description: string } | null;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Capture UTM attribution on landing and persist to localStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const source = params.get("utm_source");
    const medium = params.get("utm_medium");
    const campaign = params.get("utm_campaign");
    const content = params.get("utm_content");
    if (source || medium || campaign || content) {
      const attribution = {
        ...(source ? { source } : {}),
        ...(medium ? { medium } : {}),
        ...(campaign ? { campaign } : {}),
        ...(content ? { content } : {}),
      };
      try {
        localStorage.setItem("orthis_attribution", JSON.stringify(attribution));
      } catch {
        // localStorage may be unavailable in some environments
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), referralCode: refCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }

      setResult(data);
      setStatus("success");
      let attribution: Record<string, string> = {};
      try {
        const stored = localStorage.getItem("orthis_attribution");
        if (stored) attribution = JSON.parse(stored) as Record<string, string>;
      } catch { /* ignore */ }
      posthog.capture("waitlist_signup", { referral: !!refCode, ...attribution });
    } catch {
      setErrorMsg("Network error. Please check your connection and try again.");
      setStatus("error");
    }
  };

  const handleCopy = async () => {
    if (!result?.referralLink) return;
    try {
      await navigator.clipboard.writeText(result.referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  const shareText = result
    ? `I just joined the Or This? waitlist — get instant AI feedback on your outfits! Join here: ${result.referralLink}`
    : "";

  const isDark = variant === "dark";

  if (status === "success") {
    return (
      <div className="text-center">
        <h3 className={`text-2xl font-bold mb-1 ${isDark ? "text-white" : "text-clarity"}`}>
          {result?.alreadyJoined ? "You\u2019re already in!" : "You\u2019re on the list!"}
        </h3>
        <p className={`text-lg font-semibold mb-1 ${isDark ? "text-white/70" : "text-clarity"}`}>
          Position #{result?.position}
        </p>
        <p className={`text-sm mb-4 ${isDark ? "text-white/50" : "text-clarity/50"}`}>
          Share your link &mdash; every friend who joins moves you up 5 spots.
        </p>
        {result?.nextTier && (
          <div
            className="mb-6 px-4 py-3 text-left"
            style={{
              background: isDark ? "rgba(255,255,255,0.06)" : "rgba(26,26,26,0.04)",
              borderLeft: "2px solid #E85D4C",
            }}
          >
            {result.currentTier && (
              <p className="text-xs font-medium uppercase tracking-widest mb-1" style={{ color: "#E85D4C" }}>
                {result.currentTier.label} unlocked
              </p>
            )}
            <p className={`text-xs ${isDark ? "text-white/60" : "text-clarity/60"}`}>
              Invite {result.nextTier.count - (result.referralCount ?? 0)} more{" "}
              {(result.nextTier.count - (result.referralCount ?? 0)) === 1 ? "person" : "people"}{" "}
              to unlock <strong>{result.nextTier.label}</strong>{" "}
              — {result.nextTier.description}.
            </p>
          </div>
        )}
        {result?.currentTier && !result?.nextTier && (
          <div
            className="mb-6 px-4 py-3 text-left"
            style={{
              background: isDark ? "rgba(255,255,255,0.06)" : "rgba(26,26,26,0.04)",
              borderLeft: "2px solid #10B981",
            }}
          >
            <p className="text-xs font-medium uppercase tracking-widest" style={{ color: "#10B981" }}>
              {result.currentTier.label} — all milestones unlocked
            </p>
          </div>
        )}
        <div
          className={`flex items-center gap-2 px-4 py-3 mb-4 border ${
            isDark ? "border-white/20" : "border-clarity/20"
          }`}
        >
          <span
            className={`flex-1 text-xs truncate text-left ${
              isDark ? "text-white/60" : "text-clarity/60"
            }`}
          >
            {result?.referralLink}
          </span>
          <button
            onClick={handleCopy}
            className={`section-label px-3 py-1.5 flex-shrink-0 transition-colors ${
              isDark
                ? "bg-white text-clarity hover:bg-white/80"
                : "bg-clarity text-white hover:bg-coral"
            }`}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`section-label flex items-center justify-center gap-2 px-5 py-2.5 transition-colors ${
              isDark
                ? "bg-white/10 text-white hover:bg-white/20"
                : "bg-clarity/10 text-clarity hover:bg-clarity/20"
            }`}
          >
            WhatsApp
          </a>
          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`section-label flex items-center justify-center gap-2 px-5 py-2.5 transition-colors ${
              isDark
                ? "bg-white/10 text-white hover:bg-white/20"
                : "bg-clarity/10 text-clarity hover:bg-clarity/20"
            }`}
          >
            Post on X
          </a>
          <button
            onClick={handleCopy}
            className={`section-label flex items-center justify-center gap-2 px-5 py-2.5 transition-colors ${
              isDark
                ? "bg-white/10 text-white hover:bg-white/20"
                : "bg-clarity/10 text-clarity hover:bg-clarity/20"
            }`}
          >
            {copied ? "Copied!" : "Copy Link"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`waitlist-editorial${isDark ? "" : " light"}`}>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-0">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
          disabled={status === "loading"}
        />
        <button type="submit" disabled={status === "loading" || !email.trim()}>
          {status === "loading" ? "Joining..." : "Get Early Access"}
        </button>
      </form>
      {refCode && (
        <p
          className="mt-3 text-sm"
          style={{ color: isDark ? "rgba(255,255,255,0.5)" : "rgba(26,26,26,0.4)" }}
        >
          You were invited by a friend &mdash; welcome!
        </p>
      )}
      {status === "error" && (
        <p className="mt-3 text-sm text-red-400">{errorMsg}</p>
      )}
      <p
        className="mt-4 text-xs"
        style={{ color: isDark ? "rgba(255,255,255,0.3)" : "rgba(26,26,26,0.3)" }}
      >
        Free to join. iOS available now &mdash; Android coming soon.
      </p>
    </div>
  );
}
