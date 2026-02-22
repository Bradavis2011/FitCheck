"use client";

import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import posthog from "posthog-js";

/* ─────────────────────────────────────────────
   HOOKS
   ───────────────────────────────────────────── */

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.classList.add("js");

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -20px 0px" }
    );

    const children = el.querySelectorAll(".fade-in-up");
    children.forEach((child) => observer.observe(child));
    if (el.classList.contains("fade-in-up")) observer.observe(el);

    return () => observer.disconnect();
  }, []);

  return ref;
}

function useStickyNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return scrolled;
}

/* ─────────────────────────────────────────────
   MAIN PAGE
   ───────────────────────────────────────────── */

function WaitlistPage() {
  const searchParams = useSearchParams();
  const refCode = searchParams.get("ref") || "";

  const scrolled = useStickyNav();
  const heroRef = useScrollReveal();
  const anxietyRef = useScrollReveal();
  const productRef = useScrollReveal();
  const comparisonRef = useScrollReveal();
  const incentiveRef = useScrollReveal();
  const ctaRef = useScrollReveal();

  const scrollToWaitlist = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById("waitlist")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <div className="min-h-screen bg-cream">

      {/* ── 1. Nav ── */}
      <nav className={`nav-sticky fixed top-0 left-0 right-0 z-50 ${scrolled ? "scrolled" : ""}`}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Logo />
          <a
            href="#waitlist"
            onClick={scrollToWaitlist}
            className="text-sm font-semibold px-5 py-2.5 rounded-full text-white bg-coral transition-all hover:bg-coral-dark"
          >
            Get Early Access
          </a>
        </div>
      </nav>

      {/* ── 2. Hero — "The Feeling" + Primary Capture ── */}
      <section className="pt-28 sm:pt-36 pb-20 sm:pb-28" ref={heroRef}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
            {/* Left: copy */}
            <div className="flex-1 text-center lg:text-left">
              <div className="fade-in-up">
                <p className="text-sm font-medium text-charcoal/60 mb-6">
                  For everyone who&apos;s ever changed three times before leaving
                </p>
                <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.08] mb-4 text-clarity">
                  You already know
                  <br />
                  the question.
                </h1>
                <p className="text-3xl sm:text-4xl font-display italic text-coral mb-6">
                  Or this?
                </p>
                <p className="text-lg sm:text-xl text-charcoal max-w-lg mx-auto lg:mx-0 mb-8 leading-relaxed">
                  Standing in front of your mirror at 8:47, holding up two tops, running late.
                  You need a real answer — not &ldquo;both are cute&rdquo; from someone who isn&apos;t even looking.
                </p>
                {/* Early access badge */}
                <div
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-8"
                  style={{ backgroundColor: "rgba(232, 93, 76, 0.1)", color: "#E85D4C" }}
                >
                  <span aria-hidden>✦</span>
                  Early members get Plus free for their first month
                </div>
              </div>

              {/* Waitlist form */}
              <div id="waitlist" className="fade-in-up max-w-md mx-auto lg:mx-0">
                <WaitlistForm refCode={refCode} />
              </div>
            </div>

            {/* Right: phone mockup */}
            <div className="flex-shrink-0 fade-in-up">
              <div className="phone-float">
                <PhoneMockup />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. "The Cost of Not Knowing" — Emotional Amplification ── */}
      <section className="py-20 sm:py-28 bg-cream-dark" ref={anxietyRef}>
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex flex-col gap-6 stagger">
            {[
              "You tried on four things. Left in the first one anyway. Thought about it all day.",
              "You sent the mirror selfie. She said \"cute !!!\" You know exactly what that means.",
              "You're already there. Already in it. And you can't stop wondering if the other one was better.",
            ].map((text) => (
              <div
                key={text}
                className="fade-in-up pl-5 py-5 pr-6 rounded-r-xl"
                style={{ borderLeft: "3px solid #E85D4C", backgroundColor: "rgba(255, 255, 255, 0.65)" }}
              >
                <p className="text-charcoal text-lg leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. "The Answer" — Product Reveal ── */}
      <section className="py-20 sm:py-28" ref={productRef}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row-reverse items-center gap-12 lg:gap-16">
            {/* Right: copy */}
            <div className="flex-1 text-center lg:text-left">
              <div className="fade-in-up">
                <p className="text-sm font-medium tracking-wide uppercase mb-4 text-coral">
                  Your phone. Ten seconds. Done.
                </p>
                <h2 className="text-4xl sm:text-5xl font-bold text-clarity mb-8 leading-tight">
                  It tells you
                  <br />
                  <span className="font-display italic text-coral">the truth.</span>
                </h2>
                <ul className="flex flex-col gap-5">
                  {[
                    "A score out of 10. No sugarcoating.",
                    "What's working, what isn't, and one thing to fix right now.",
                    "Keep asking until you're sure. 'Should I swap the shoes?' 'Is this too casual?' It doesn't care how many times you ask.",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-charcoal text-lg leading-relaxed">
                      <span className="w-6 h-6 rounded-full bg-coral flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Left: phone mockup (static — no float) */}
            <div className="flex-shrink-0 fade-in-up">
              <PhoneMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. "The Or This? Moment" — Comparison Showcase ── */}
      <section className="py-20 sm:py-28 bg-cream-dark" ref={comparisonRef}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
            {/* Left: copy */}
            <div className="flex-1 text-center lg:text-left">
              <div className="fade-in-up">
                <p className="text-sm font-medium tracking-wide uppercase mb-4 text-coral">
                  The question that named us
                </p>
                <h2 className="text-3xl sm:text-4xl font-bold text-clarity mb-6 leading-tight">
                  Hold up two options.
                  <br />
                  <span className="font-display italic text-coral">Get an answer you trust.</span>
                </h2>
                <p className="text-charcoal text-lg leading-relaxed">
                  Post both. Your community votes. You get an answer that&apos;s actually useful.
                </p>
              </div>
            </div>

            {/* Right: comparison mockup */}
            <div className="flex-shrink-0 fade-in-up">
              <ComparisonMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. "What Early Access Unlocks" — Incentive ── */}
      <section
        className="py-20 sm:py-28"
        ref={incentiveRef}
        style={{ background: "linear-gradient(135deg, #E85D4C, #FF7A6B)" }}
      >
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="fade-in-up">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              First in gets more.
            </h2>
            <p className="text-white/85 text-lg mb-10">
              Join the waitlist now. Your first month of Plus is on us.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8 stagger">
              {[
                {
                  icon: "∞",
                  label: "Check as many looks as you want",
                  sub: "no daily cap",
                },
                {
                  icon: "✦",
                  label: "It learns your style over time",
                  sub: "gets smarter every time you use it",
                },
                {
                  icon: "💬",
                  label: "Keep asking until you're sure",
                  sub: "no limit on follow-ups",
                },
              ].map((perk) => (
                <div
                  key={perk.label}
                  className="fade-in-up rounded-2xl px-6 py-7 text-center"
                  style={{ backgroundColor: "rgba(255, 255, 255, 0.15)" }}
                >
                  <div className="text-3xl text-white mb-3" aria-hidden>{perk.icon}</div>
                  <p className="font-semibold text-white mb-1">{perk.label}</p>
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.65)" }}>{perk.sub}</p>
                </div>
              ))}
            </div>

            <p className="text-sm mb-10" style={{ color: "rgba(255,255,255,0.70)" }}>
              That&apos;s $5.99/mo worth of features, free for your first month.
            </p>

            <div className="max-w-md mx-auto">
              <WaitlistForm refCode={refCode} variant="dark" />
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. Final CTA — "The Close" ── */}
      <section className="py-20 sm:py-28" ref={ctaRef}>
        <div className="max-w-5xl mx-auto px-6">
          <div
            className="fade-in-up rounded-3xl px-8 py-14 sm:px-16 sm:py-20 text-center"
            style={{ background: "linear-gradient(135deg, #E85D4C, #FF7A6B)" }}
          >
            <h2 className="text-3xl sm:text-5xl font-bold text-white mb-4 leading-tight">
              Stop wondering.
              <br />
              <span className="font-display italic">Start knowing.</span>
            </h2>
            <p className="text-white/90 text-lg mb-10 max-w-lg mx-auto">
              Join the waitlist. Your first month of Plus is included.
            </p>
            <div className="max-w-md mx-auto">
              <WaitlistForm refCode={refCode} variant="dark" />
            </div>
          </div>
        </div>
      </section>

      {/* ── 9. Footer ── */}
      <footer className="border-t border-cream-dark py-14">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-6 mb-10">
            {/* Brand */}
            <div>
              <Logo />
              <p className="text-sm text-charcoal/60 mt-3 max-w-xs">
                Confidence in every choice.
                <br />
                Launching 2026 on iOS &amp; Android.
              </p>
            </div>
            {/* Legal */}
            <div className="flex flex-col gap-2.5">
              <p className="text-xs font-bold uppercase tracking-wider text-charcoal mb-1">Legal</p>
              <Link href="/privacy" className="text-sm text-charcoal/60 hover:text-coral transition-colors">Privacy Policy</Link>
              <Link href="/terms" className="text-sm text-charcoal/60 hover:text-coral transition-colors">Terms of Service</Link>
              <Link href="/support" className="text-sm text-charcoal/60 hover:text-coral transition-colors">Support</Link>
              <Link href="/delete-account" className="text-sm text-charcoal/60 hover:text-coral transition-colors">Delete Account</Link>
            </div>
            {/* Social */}
            <div className="flex flex-col gap-2.5">
              <p className="text-xs font-bold uppercase tracking-wider text-charcoal mb-1">Follow us</p>
              <div className="flex items-center gap-4">
                <a href="https://x.com/OrThisApp" target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)" className="text-charcoal/40 hover:text-coral transition-colors">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.741l7.73-8.835L1.254 2.25H8.08l4.259 5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </a>
                <a href="https://www.tiktok.com/@or_this" target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="text-charcoal/40 hover:text-coral transition-colors">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.27 8.27 0 004.84 1.55V6.77a4.85 4.85 0 01-1.07-.08z"/></svg>
                </a>
                <a href="https://www.pinterest.com/OrThisApp/" target="_blank" rel="noopener noreferrer" aria-label="Pinterest" className="text-charcoal/40 hover:text-coral transition-colors">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/></svg>
                </a>
              </div>
            </div>
          </div>
          <div className="border-t border-cream-dark pt-6 text-center">
            <p className="text-xs text-charcoal/40">
              &copy; {new Date().getFullYear()} Or This? All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ─────────────────────────────────────────────
   WAITLIST FORM
   ───────────────────────────────────────────── */

function WaitlistForm({ refCode, variant = "light" }: { refCode: string; variant?: "light" | "dark" }) {
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
      posthog.capture("waitlist_signup", { referral: !!refCode });
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

  if (status === "success") {
    return (
      <div
        className="rounded-2xl p-7 text-center"
        style={{ backgroundColor: variant === "dark" ? "rgba(255,255,255,0.15)" : "rgba(232, 93, 76, 0.06)" }}
      >
        <h3 className={`text-2xl font-bold mb-1 ${variant === "dark" ? "text-white" : "text-clarity"}`}>
          {result?.alreadyJoined ? "You\u2019re already in!" : "You\u2019re on the list!"}
        </h3>
        <p className={`text-lg font-semibold mb-1 ${variant === "dark" ? "text-white/90" : "text-coral"}`}>
          Position #{result?.position}
        </p>
        <p className={`text-sm mb-5 ${variant === "dark" ? "text-white/70" : "text-charcoal/60"}`}>
          Share your link &mdash; every friend who joins moves you up 5 spots.
        </p>
        <div
          className="flex items-center gap-2 rounded-xl px-4 py-3 mb-4"
          style={{ backgroundColor: "rgba(0,0,0,0.08)" }}
        >
          <span className={`flex-1 text-xs truncate text-left ${variant === "dark" ? "text-white" : "text-clarity"}`}>
            {result?.referralLink}
          </span>
          <button
            onClick={handleCopy}
            className="text-xs font-semibold px-3 py-1 rounded-full flex-shrink-0 transition-opacity hover:opacity-80 bg-coral text-white"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-opacity hover:opacity-80 text-white"
            style={{ backgroundColor: "#25D366" }}
          >
            WhatsApp
          </a>
          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-opacity hover:opacity-80 text-white"
            style={{ backgroundColor: "#1DA1F2" }}
          >
            Post on X
          </a>
          <button
            onClick={handleCopy}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-opacity hover:opacity-80 ${
              variant === "dark" ? "bg-white/20 text-white" : "bg-coral/10 text-coral"
            }`}
          >
            {copied ? "Copied!" : "Copy Link"}
          </button>
        </div>
      </div>
    );
  }

  const isDark = variant === "dark";

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
          className={`flex-1 px-5 py-3.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-coral ${
            isDark
              ? "bg-white/20 text-white placeholder-white/50 border-transparent"
              : "bg-white border border-cream-dark text-clarity"
          }`}
          disabled={status === "loading"}
        />
        <button
          type="submit"
          disabled={status === "loading" || !email.trim()}
          className={`px-6 py-3.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-60 whitespace-nowrap ${
            isDark
              ? "bg-white text-coral hover:bg-cream"
              : "bg-coral text-white hover:bg-coral-dark"
          }`}
        >
          {status === "loading" ? "Joining..." : "Get Early Access"}
        </button>
      </form>
      {refCode && (
        <p className={`mt-3 text-sm ${isDark ? "text-white/70" : "text-sage"}`}>
          You were invited by a friend &mdash; welcome!
        </p>
      )}
      {status === "error" && (
        <p className="mt-3 text-sm text-red-400">{errorMsg}</p>
      )}
      <p className={`mt-4 text-xs ${isDark ? "text-white/50" : "text-charcoal/40"}`}>
        Free to join. Launching on iOS &amp; Android.
      </p>
    </>
  );
}

/* ─────────────────────────────────────────────
   LOGO
   ───────────────────────────────────────────── */

function Logo() {
  return (
    <span className="text-xl font-medium select-none">
      <span className="text-clarity">Or </span>
      <span className="font-display italic text-coral">This?</span>
    </span>
  );
}

/* ─────────────────────────────────────────────
   PHONE MOCKUP
   ───────────────────────────────────────────── */

function PhoneMockup() {
  return (
    <div className="relative w-[280px] sm:w-[300px]">
      {/* Phone frame */}
      <div className="rounded-[40px] bg-clarity p-3 shadow-2xl">
        <div className="rounded-[30px] overflow-hidden bg-cream">
          {/* Status bar */}
          <div className="flex items-center justify-between px-6 pt-3 pb-2">
            <span className="text-[10px] font-semibold text-clarity">9:41</span>
            <div className="flex items-center gap-1">
              <svg width="14" height="10" viewBox="0 0 14 10" fill="#1A1A1A" aria-hidden>
                <rect x="0" y="6" width="2.5" height="4" rx="0.5"/>
                <rect x="3.5" y="4" width="2.5" height="6" rx="0.5"/>
                <rect x="7" y="2" width="2.5" height="8" rx="0.5"/>
                <rect x="10.5" y="0" width="2.5" height="10" rx="0.5"/>
              </svg>
              <svg width="20" height="10" viewBox="0 0 20 10" fill="none" stroke="#1A1A1A" strokeWidth="1" aria-hidden>
                <rect x="0.5" y="0.5" width="17" height="9" rx="2"/>
                <rect x="18" y="3" width="2" height="4" rx="0.5" fill="#1A1A1A"/>
                <rect x="2" y="2" width="12" height="6" rx="1" fill="#10B981"/>
              </svg>
            </div>
          </div>

          {/* App content: feedback screen */}
          <div className="px-5 pb-6">
            {/* Score */}
            <div className="text-center mb-4 mt-2">
              <p className="text-[10px] text-charcoal/60 uppercase tracking-wider mb-1">Your Score</p>
              <div className="text-5xl font-bold text-[#10B981]">8.5</div>
              <p className="text-xs text-charcoal/60 mt-1">Date Night &bull; Trendy</p>
            </div>

            {/* What's Working card */}
            <div className="bg-cream-dark rounded-xl p-3 mb-3">
              <p className="text-[10px] font-bold text-clarity mb-1.5 uppercase tracking-wide">What&apos;s Working</p>
              <p className="text-[11px] text-charcoal leading-relaxed">
                The blazer-over-dress combo is a strong choice. It adds structure and the color contrast is spot on.
              </p>
            </div>

            {/* Quick Fix card */}
            <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: "rgba(232, 93, 76, 0.08)" }}>
              <p className="text-[10px] font-bold text-coral mb-1.5 uppercase tracking-wide">Quick Fix</p>
              <p className="text-[11px] text-charcoal leading-relaxed">
                Swap the flats for a heeled ankle boot to complete the silhouette.
              </p>
            </div>

            {/* Verdict */}
            <div className="rounded-xl p-3" style={{ background: "linear-gradient(135deg, #E85D4C, #FF7A6B)" }}>
              <p className="text-[10px] font-bold text-white/80 mb-1 uppercase tracking-wide">Verdict</p>
              <p className="text-[11px] text-white leading-relaxed">
                You look great. One small shoe swap and this is a 9+.
              </p>
            </div>
          </div>
        </div>
      </div>
      {/* Notch */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[100px] h-[28px] bg-clarity rounded-b-2xl" />
    </div>
  );
}

/* ─────────────────────────────────────────────
   COMPARISON MOCKUP
   ───────────────────────────────────────────── */

function ComparisonMockup() {
  return (
    <div className="relative w-[280px] sm:w-[320px]">
      <div className="rounded-[40px] bg-clarity p-3 shadow-2xl">
        <div className="rounded-[30px] overflow-hidden bg-cream">
          {/* Status bar */}
          <div className="flex items-center justify-between px-6 pt-3 pb-2">
            <span className="text-[10px] font-semibold text-clarity">9:41</span>
            <div className="flex items-center gap-1">
              <svg width="14" height="10" viewBox="0 0 14 10" fill="#1A1A1A" aria-hidden>
                <rect x="0" y="6" width="2.5" height="4" rx="0.5"/>
                <rect x="3.5" y="4" width="2.5" height="6" rx="0.5"/>
                <rect x="7" y="2" width="2.5" height="8" rx="0.5"/>
                <rect x="10.5" y="0" width="2.5" height="10" rx="0.5"/>
              </svg>
              <svg width="20" height="10" viewBox="0 0 20 10" fill="none" stroke="#1A1A1A" strokeWidth="1" aria-hidden>
                <rect x="0.5" y="0.5" width="17" height="9" rx="2"/>
                <rect x="18" y="3" width="2" height="4" rx="0.5" fill="#1A1A1A"/>
                <rect x="2" y="2" width="12" height="6" rx="1" fill="#10B981"/>
              </svg>
            </div>
          </div>

          {/* Header */}
          <div className="text-center px-5 mb-3 mt-1">
            <p className="text-xs font-bold text-clarity">Or This?</p>
            <p className="text-[10px] text-charcoal/60">Saturday Brunch</p>
          </div>

          {/* Two outfits side by side */}
          <div className="px-4 pb-5 flex gap-2">
            {/* Option A */}
            <div className="flex-1">
              <div className="rounded-xl bg-sage-light aspect-[3/4] flex items-center justify-center mb-2 relative overflow-hidden">
                <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(196,207,189,0.5), rgba(168,181,160,0.3))" }} />
                <div className="relative text-center">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2D2D2D" strokeWidth="1.2" strokeLinecap="round" aria-hidden>
                    <path d="M12 2C8 2 6 5 6 8c0 2 .5 3 1 4l-1 8h12l-1-8c.5-1 1-2 1-4 0-3-2-6-6-6z"/>
                    <path d="M9 20v2h6v-2"/>
                  </svg>
                  <p className="text-[9px] font-semibold text-charcoal mt-1">Floral Midi</p>
                </div>
              </div>
              <div className="bg-coral rounded-lg py-2 text-center">
                <p className="text-white font-bold text-sm">68%</p>
              </div>
            </div>
            {/* Option B */}
            <div className="flex-1">
              <div className="rounded-xl bg-cream-dark aspect-[3/4] flex items-center justify-center mb-2 relative overflow-hidden">
                <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(245,237,231,0.5), #F5EDE7)" }} />
                <div className="relative text-center">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2D2D2D" strokeWidth="1.2" strokeLinecap="round" aria-hidden>
                    <rect x="6" y="4" width="12" height="8" rx="1"/>
                    <path d="M6 12l-1 8h14l-1-8"/>
                    <path d="M9 2v2h6V2"/>
                  </svg>
                  <p className="text-[9px] font-semibold text-charcoal mt-1">Blazer + Jeans</p>
                </div>
              </div>
              <div className="rounded-lg py-2 text-center" style={{ backgroundColor: "rgba(45,45,45,0.15)" }}>
                <p className="text-charcoal font-bold text-sm">32%</p>
              </div>
            </div>
          </div>

          {/* Vote count */}
          <div className="text-center pb-4">
            <p className="text-[10px] text-charcoal/50">142 votes</p>
          </div>
        </div>
      </div>
      {/* Notch */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[100px] h-[28px] bg-clarity rounded-b-2xl" />
    </div>
  );
}

/* ─────────────────────────────────────────────
   ROOT EXPORT
   ───────────────────────────────────────────── */

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-cream" />}>
      <WaitlistPage />
    </Suspense>
  );
}
