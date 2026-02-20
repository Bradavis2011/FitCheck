"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

// Inner component that uses useSearchParams (requires Suspense boundary)
function WaitlistPage() {
  const searchParams = useSearchParams();
  const refCode = searchParams.get("ref") || "";

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState<{
    position: number;
    referralCode: string;
    referralLink: string;
    alreadyJoined?: boolean;
  } | null>(null);
  const [copied, setCopied] = useState(false);

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

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FBF7F4" }}>
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto">
        <Logo />
        <div className="flex items-center gap-6">
          <a href="#features" className="text-sm font-medium text-[#2D2D2D] hover:text-[#E85D4C] transition-colors hidden sm:block">Features</a>
          <a href="#pricing" className="text-sm font-medium text-[#2D2D2D] hover:text-[#E85D4C] transition-colors hidden sm:block">Pricing</a>
          <a
            href="#waitlist"
            className="text-sm font-semibold px-4 py-2 rounded-full text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#E85D4C" }}
          >
            Get Early Access
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-16 pb-24 text-center">
        <div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-8"
          style={{ backgroundColor: "#F5EDE7", color: "#E85D4C" }}
        >
          <span>✨</span> AI-powered outfit feedback
        </div>
        <h1 className="text-5xl sm:text-6xl font-bold leading-tight mb-6" style={{ color: "#1A1A1A" }}>
          Stop second-guessing
          <br />
          <span className="font-display italic" style={{ color: "#E85D4C" }}>
            your outfits.
          </span>
        </h1>
        <p className="text-xl text-[#2D2D2D] max-w-xl mx-auto mb-10 leading-relaxed">
          Snap a photo, get instant AI feedback on your look — score, what&apos;s working,
          and exactly what to fix. Confidence in every choice.
        </p>

        {/* Waitlist form */}
        <div id="waitlist" className="max-w-md mx-auto">
          {status !== "success" ? (
            <>
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="flex-1 px-5 py-3 rounded-2xl border text-[#1A1A1A] text-sm outline-none focus:ring-2 focus:ring-[#E85D4C]"
                  style={{ backgroundColor: "#fff", borderColor: "#E8E8E8" }}
                  disabled={status === "loading"}
                />
                <button
                  type="submit"
                  disabled={status === "loading" || !email.trim()}
                  className="px-6 py-3 rounded-2xl text-white font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-60 whitespace-nowrap"
                  style={{ backgroundColor: "#E85D4C" }}
                >
                  {status === "loading" ? "Joining..." : "Get Early Access"}
                </button>
              </form>
              {refCode && (
                <p className="mt-3 text-sm" style={{ color: "#A8B5A0" }}>
                  You were referred — you&apos;ll jump ahead in the queue!
                </p>
              )}
              {status === "error" && (
                <p className="mt-3 text-sm text-red-500">{errorMsg}</p>
              )}
              <p className="mt-4 text-xs" style={{ color: "#9B9B9B" }}>
                Free to start. No credit card required. Launching on Android first.
              </p>
            </>
          ) : (
            /* Post-signup success state */
            <div
              className="rounded-3xl p-8 text-center"
              style={{ background: "linear-gradient(135deg, #E85D4C, #FF7A6B)" }}
            >
              <div className="text-4xl mb-3">🎉</div>
              <h2 className="text-2xl font-bold text-white mb-1">
                {result?.alreadyJoined ? "You're already in!" : "You're on the list!"}
              </h2>
              <p className="text-white/90 text-lg font-semibold mb-1">
                Queue position: #{result?.position}
              </p>
              <p className="text-white/80 text-sm mb-6">
                Share your link — every friend who joins moves you up 5 spots.
              </p>

              {/* Referral link box */}
              <div
                className="flex items-center gap-2 rounded-2xl px-4 py-3 mb-4"
                style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
              >
                <span className="flex-1 text-white text-xs truncate text-left">
                  {result?.referralLink}
                </span>
                <button
                  onClick={handleCopy}
                  className="text-white font-semibold text-xs px-3 py-1 rounded-full flex-shrink-0 transition-opacity hover:opacity-80"
                  style={{ backgroundColor: "rgba(255,255,255,0.3)" }}
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>

              {/* Share buttons */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-2xl font-semibold text-sm transition-opacity hover:opacity-80"
                  style={{ backgroundColor: "#25D366", color: "#fff" }}
                >
                  <span>💬</span> WhatsApp
                </a>
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-2xl font-semibold text-sm transition-opacity hover:opacity-80"
                  style={{ backgroundColor: "#1DA1F2", color: "#fff" }}
                >
                  <span>𝕏</span> Tweet
                </a>
                <button
                  onClick={handleCopy}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-2xl font-semibold text-sm transition-opacity hover:opacity-80"
                  style={{ backgroundColor: "rgba(255,255,255,0.25)", color: "#fff" }}
                >
                  <span>🔗</span> {copied ? "Copied!" : "Copy Link"}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-5xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-14" style={{ color: "#1A1A1A" }}>
          Everything you need to dress with{" "}
          <span className="font-display italic" style={{ color: "#E85D4C" }}>confidence</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="p-6 rounded-2xl" style={{ backgroundColor: "#F5EDE7" }}>
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3 className="font-semibold text-lg mb-2" style={{ color: "#1A1A1A" }}>{f.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "#2D2D2D" }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-5xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-4" style={{ color: "#1A1A1A" }}>
          Simple, honest pricing
        </h2>
        <p className="text-center mb-12" style={{ color: "#2D2D2D" }}>Start free. Upgrade when you&apos;re ready.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`p-6 rounded-2xl flex flex-col ${plan.featured ? "border-2" : ""}`}
              style={{
                backgroundColor: plan.featured ? "#fff" : "#F5EDE7",
                borderColor: plan.featured ? "#E85D4C" : "transparent",
              }}
            >
              {plan.featured && (
                <div className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: "#E85D4C" }}>
                  Most Popular
                </div>
              )}
              <div className="font-bold text-xl mb-1" style={{ color: "#1A1A1A" }}>{plan.name}</div>
              <div className="text-3xl font-bold mb-1" style={{ color: "#E85D4C" }}>{plan.price}</div>
              <div className="text-sm mb-6" style={{ color: "#9B9B9B" }}>{plan.period}</div>
              <ul className="flex flex-col gap-2 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm" style={{ color: "#2D2D2D" }}>
                    <span style={{ color: "#E85D4C" }}>✓</span> {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-6 py-20 text-center">
        <div className="rounded-3xl p-12" style={{ background: "linear-gradient(135deg, #E85D4C, #FF7A6B)" }}>
          <h2 className="text-4xl font-bold text-white mb-4">
            Ready to dress with{" "}
            <span className="font-display italic">confidence?</span>
          </h2>
          <p className="text-white/90 text-lg mb-8">Be the first to get access when we launch.</p>
          <a
            href="#waitlist"
            className="inline-block px-8 py-4 rounded-2xl font-semibold text-base transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#fff", color: "#E85D4C" }}
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("waitlist")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Join the Waitlist
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8" style={{ borderColor: "#E8E8E8" }}>
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo />
          <div className="flex items-center gap-6 text-sm" style={{ color: "#9B9B9B" }}>
            <Link href="/privacy" className="hover:text-[#E85D4C] transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-[#E85D4C] transition-colors">Terms of Service</Link>
          </div>
          <p className="text-sm" style={{ color: "#9B9B9B" }}>© {new Date().getFullYear()} Or This? All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function Logo() {
  return (
    <span className="text-xl font-medium select-none">
      <span style={{ color: "#1A1A1A" }}>Or </span>
      <span className="font-display italic" style={{ color: "#E85D4C" }}>This?</span>
    </span>
  );
}

const features = [
  { icon: "📸", title: "Instant AI Analysis", desc: "Snap your outfit and get a score, detailed feedback, and styling tips in seconds." },
  { icon: "🎯", title: "Occasion Matching", desc: "Tell us where you're going — work, date night, interview — and get feedback that fits." },
  { icon: "💬", title: "Ask Follow-ups", desc: "Not sure about a specific piece? Ask the AI follow-up questions about your look." },
  { icon: "📊", title: "Style DNA", desc: "Over time, the app learns your style patterns, colors, and what works best for you." },
  { icon: "🏆", title: "Outfit History", desc: "Every look you've checked is saved so you can reference your best outfits anytime." },
  { icon: "👥", title: "Community Feed", desc: "Share your best looks and get feedback from a community of style-conscious people." },
];

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    featured: false,
    features: ["3 outfit checks per day", "Basic AI feedback", "7-day outfit history"],
  },
  {
    name: "Plus",
    price: "$5.99",
    period: "per month",
    featured: true,
    features: ["Unlimited outfit checks", "Full AI feedback + Style DNA", "Unlimited history", "Follow-up questions", "Community sharing"],
  },
  {
    name: "Pro",
    price: "$14.99",
    period: "per month",
    featured: false,
    features: ["Everything in Plus", "Priority AI processing", "Advanced style analytics", "Outfit recommendations", "Early access to features"],
  },
];

export default function Home() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", backgroundColor: "#FBF7F4" }} />}>
      <WaitlistPage />
    </Suspense>
  );
}
