"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import posthog from "posthog-js";

// Local illustration assets
import illustrationDuo from "../assets/images/fabian-kunzel-zeller-Kd0oUzb2Bfg-unsplash.jpg";
import illustrationBlue from "../assets/images/fabian-kunzel-zeller-LLXs757C7DA-unsplash.jpg";
import illustrationTan from "../assets/images/fabian-kunzel-zeller-xZokPso8xys-unsplash.jpg";
import illustrationPurple from "../assets/images/fabian-kunzel-zeller-Ir7tmdZ6dWU-unsplash.jpg";
import charlotaPhoto from "../assets/images/charlota-blunarova-r5xHI_H44aM-unsplash.jpg";

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
          if (entry.isIntersecting) entry.target.classList.add("visible");
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -20px 0px" }
    );

    const children = el.querySelectorAll(".fade-in-up");
    children.forEach((child) => observer.observe(child));

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
  const pageRef = useScrollReveal();

  const scrollToWaitlist = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById("waitlist")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <div className="min-h-screen bg-white" ref={pageRef}>

      {/* ── 1. Nav ── */}
      <nav className={`nav-sticky fixed top-0 left-0 right-0 z-50 ${scrolled ? "scrolled" : ""}`}>
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <Logo />
          <a
            href="#waitlist"
            onClick={scrollToWaitlist}
            className="text-sm font-medium text-clarity hover:text-coral transition-colors"
          >
            Join
          </a>
        </div>
      </nav>

      {/* ── 2. Hero — Full-bleed video, 100vh ── */}
      <section className="relative w-full h-screen overflow-hidden">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="/video/7305164-uhd_4096_2160_25fps.mp4" type="video/mp4" />
        </video>
        <div className="hero-overlay absolute inset-0" />
        <div className="relative h-full flex flex-col items-center justify-center text-center px-6 pt-20">
          <p className="section-label text-white/50 mb-8 fade-in-up">
            For everyone who&apos;s ever changed three times before leaving
          </p>
          <h1 className="pull-quote text-6xl sm:text-7xl lg:text-8xl text-white leading-tight mb-6 fade-in-up max-w-4xl">
            You already know<br />the question.
          </h1>
          <p className="pull-quote text-4xl sm:text-5xl lg:text-6xl mb-14 fade-in-up">
            <span className="text-clarity">Or </span>
            <span className="font-display italic text-coral">This?</span>
          </p>
          <div className="w-full max-w-md fade-in-up">
            <WaitlistForm refCode={refCode} variant="dark" />
          </div>
        </div>
      </section>

      {/* ── 3. Pull Quotes ── */}
      <section className="py-32 sm:py-40 bg-white">
        <div className="max-w-3xl mx-auto px-6">
          {[
            "You tried on four things. Left in the first one anyway. Thought about it all day.",
            "You sent the mirror selfie. She said \"cute !!!\" You know exactly what that means.",
            "You\u2019re already there. Already in it. And you can\u2019t stop wondering if the other one was better.",
          ].map((quote, i) => (
            <div key={i} className="fade-in-up">
              <p className="pull-quote text-3xl sm:text-4xl text-clarity leading-tight py-14 sm:py-16">
                {quote}
              </p>
              {i < 2 && (
                <span
                  className="editorial-rule"
                  style={{ backgroundColor: "rgba(26,26,26,0.15)" }}
                />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── 4. The Answer — Black bg, illustration left ── */}
      <section className="bg-clarity">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row items-stretch">
            {/* Left: editorial illustration */}
            <div
              className="editorial-image relative flex-1 fade-in-up"
              style={{ minHeight: "60vh" }}
            >
              <Image
                src={illustrationDuo}
                alt="Two women in editorial fashion illustration"
                fill
                className="object-cover object-top"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
            {/* Right: copy */}
            <div className="flex-1 flex flex-col justify-center px-10 py-20 sm:px-16 fade-in-up">
              <span
                className="editorial-rule mb-8"
                style={{ backgroundColor: "#E85D4C" }}
              />
              <p className="section-label text-white/40 mb-6">
                Your phone. Ten seconds. Done.
              </p>
              <h2 className="pull-quote text-5xl sm:text-6xl text-white leading-tight mb-10">
                It tells you<br />the truth.
              </h2>
              <ul className="flex flex-col gap-6">
                {[
                  "A score out of 10. No sugarcoating.",
                  "What\u2019s working, what isn\u2019t, and one thing to fix right now.",
                  "Keep asking until you\u2019re sure. \u2018Should I swap the shoes?\u2019 It doesn\u2019t care how many times you ask.",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-4 text-white/75 text-lg leading-relaxed"
                  >
                    <span
                      className="font-display text-xl flex-shrink-0 mt-0.5"
                      style={{ color: "#E85D4C" }}
                    >
                      &mdash;
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. Editorial Grid — 4 illustrations ── */}
      <section className="py-24 sm:py-32 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {/* Tall left — spans 2 rows */}
            <div
              className="row-span-2 editorial-image relative fade-in-up"
              style={{ minHeight: "600px" }}
            >
              <Image
                src={illustrationBlue}
                alt="Fashion illustration — woman in dark jacket, navy background"
                fill
                className="object-cover object-top"
                sizes="(max-width: 640px) 100vw, 50vw"
              />
              <div
                className="absolute bottom-0 left-0 right-0 p-8"
                style={{
                  background:
                    "linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 100%)",
                }}
              >
                <p className="pull-quote text-2xl sm:text-3xl text-white leading-tight">
                  &ldquo;Confidence in<br />every choice.&rdquo;
                </p>
              </div>
            </div>

            {/* Top-right */}
            <div
              className="editorial-image relative fade-in-up"
              style={{ minHeight: "290px" }}
            >
              <Image
                src={illustrationTan}
                alt="Fashion illustration — woman looking over shoulder"
                fill
                className="object-cover object-top"
                sizes="(max-width: 640px) 100vw, 50vw"
              />
            </div>

            {/* Bottom-right */}
            <div
              className="editorial-image relative fade-in-up"
              style={{ minHeight: "290px" }}
            >
              <Image
                src={illustrationPurple}
                alt="Fashion illustration — woman in editorial style"
                fill
                className="object-cover object-top"
                sizes="(max-width: 640px) 100vw, 50vw"
              />
            </div>

            {/* Full-width bottom row — Charlota Blunarova */}
            <div
              className="col-span-2 editorial-image relative fade-in-up"
              style={{ minHeight: "400px" }}
            >
              <Image
                src={charlotaPhoto}
                alt="Fashion editorial photograph by Charlota Blunarova"
                fill
                className="object-cover object-center"
                sizes="(max-width: 640px) 100vw, 100vw"
              />
            </div>
          </div>
          <p className="text-xs text-center mt-4" style={{ color: "rgba(26,26,26,0.3)" }}>
            Photos by{" "}
            <a
              href="https://www.instagram.com/kuenzelzeller"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
              style={{ color: "rgba(26,26,26,0.4)" }}
            >
              Fabian Künzel-Zeller
            </a>
            {" "}·{" "}
            <a
              href="https://www.instagram.com/charlotablunarova"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
              style={{ color: "rgba(26,26,26,0.4)" }}
            >
              Charlota Blunarova
            </a>
          </p>
        </div>
      </section>

      {/* ── 6. Early Access — Black bg ── */}
      <section className="py-28 sm:py-36 bg-clarity" id="waitlist">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-20 fade-in-up">
            <p className="section-label text-white/40 mb-6">First in gets more</p>
            <h2 className="pull-quote text-5xl sm:text-6xl text-white leading-tight mb-4">
              Join the waitlist now.
            </h2>
            <p className="text-white/50 text-lg">
              Your first month of Plus is on us.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 mb-20">
            {[
              {
                symbol: "∞",
                label: "Check as many looks as you want",
                sub: "No daily cap.",
              },
              {
                symbol: "✦",
                label: "It learns your style over time",
                sub: "Gets smarter every use.",
              },
              {
                symbol: "◌",
                label: "Keep asking until you\u2019re sure",
                sub: "No limit on follow-ups.",
              },
            ].map((perk, i) => (
              <div
                key={perk.label}
                className={`fade-in-up px-8 py-10 ${i > 0 ? "border-l border-white/10" : ""}`}
              >
                <p className="text-3xl mb-5 font-light" style={{ color: "rgba(255,255,255,0.2)" }}>
                  {perk.symbol}
                </p>
                <p className="text-white text-base font-medium mb-2 leading-snug">
                  {perk.label}
                </p>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {perk.sub}
                </p>
              </div>
            ))}
          </div>

          <div className="max-w-lg mx-auto fade-in-up">
            <WaitlistForm refCode={refCode} variant="dark" />
          </div>
        </div>
      </section>

      {/* ── 7. Portrait — Cinematic video, 21:9 ── */}
      <section
        className="relative w-full overflow-hidden"
        style={{ aspectRatio: "21/9" }}
      >
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="/video/5822800-hd_1920_1080_25fps.mp4" type="video/mp4" />
        </video>
        <div className="hero-overlay absolute inset-0" />
        <div className="relative h-full flex items-center justify-center text-center px-6">
          <h2 className="pull-quote text-4xl sm:text-6xl lg:text-7xl text-white leading-tight">
            Stop wondering.<br />Start knowing.
          </h2>
        </div>
      </section>

      {/* ── 8. Final CTA — White ── */}
      <section className="py-28 sm:py-36 bg-white">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <div className="fade-in-up">
            <h2 className="pull-quote text-5xl sm:text-6xl text-clarity leading-tight mb-6">
              Your mirror can&apos;t tell&nbsp;you.<br />We can.
            </h2>
            <p className="text-lg mb-12 max-w-md mx-auto leading-relaxed" style={{ color: "rgba(45,45,45,0.5)" }}>
              Join the waitlist. Your first month of Plus is included.
            </p>
            <div className="max-w-md mx-auto text-left">
              <WaitlistForm refCode={refCode} variant="light" />
            </div>
          </div>
        </div>
      </section>

      {/* ── 9. Footer — White ── */}
      <footer className="border-t py-14 bg-white" style={{ borderColor: "rgba(26,26,26,0.1)" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-6 mb-10">
            <div>
              <Logo />
              <p className="text-sm mt-3 max-w-xs" style={{ color: "rgba(26,26,26,0.3)" }}>
                Confidence in every choice.
                <br />
                Launching 2026 on iOS &amp; Android.
              </p>
            </div>
            <div className="flex flex-col gap-2.5">
              <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: "rgba(26,26,26,0.3)" }}>
                Legal
              </p>
              <Link href="/privacy" className="text-sm transition-colors hover:text-clarity" style={{ color: "rgba(26,26,26,0.4)" }}>
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-sm transition-colors hover:text-clarity" style={{ color: "rgba(26,26,26,0.4)" }}>
                Terms of Service
              </Link>
              <Link href="/support" className="text-sm transition-colors hover:text-clarity" style={{ color: "rgba(26,26,26,0.4)" }}>
                Support
              </Link>
              <Link href="/delete-account" className="text-sm transition-colors hover:text-clarity" style={{ color: "rgba(26,26,26,0.4)" }}>
                Delete Account
              </Link>
            </div>
            <div className="flex flex-col gap-2.5">
              <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: "rgba(26,26,26,0.3)" }}>
                Follow
              </p>
              <div className="flex items-center gap-4">
                <a
                  href="https://x.com/OrThisApp"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="X (Twitter)"
                  className="transition-colors hover:text-clarity"
                  style={{ color: "rgba(26,26,26,0.2)" }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.741l7.73-8.835L1.254 2.25H8.08l4.259 5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
                <a
                  href="https://www.tiktok.com/@or_this"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="TikTok"
                  className="transition-colors hover:text-clarity"
                  style={{ color: "rgba(26,26,26,0.2)" }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.27 8.27 0 004.84 1.55V6.77a4.85 4.85 0 01-1.07-.08z" />
                  </svg>
                </a>
                <a
                  href="https://www.pinterest.com/OrThisApp/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Pinterest"
                  className="transition-colors hover:text-clarity"
                  style={{ color: "rgba(26,26,26,0.2)" }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
          <div className="border-t pt-6 text-center" style={{ borderColor: "rgba(26,26,26,0.1)" }}>
            <p className="text-xs" style={{ color: "rgba(26,26,26,0.2)" }}>
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
        <p className={`text-sm mb-6 ${isDark ? "text-white/50" : "text-clarity/50"}`}>
          Share your link &mdash; every friend who joins moves you up 5 spots.
        </p>
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
        Free to join. Launching on iOS &amp; Android.
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────
   LOGO
   ───────────────────────────────────────────── */

function Logo() {
  return (
    <span className="pull-quote text-xl select-none">
      <span className="text-clarity">Or </span>
      <span className="font-display italic text-coral">This?</span>
    </span>
  );
}

/* ─────────────────────────────────────────────
   ROOT EXPORT
   ───────────────────────────────────────────── */

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <WaitlistPage />
    </Suspense>
  );
}
