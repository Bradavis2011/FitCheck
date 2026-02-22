"use client";

import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import posthog from "posthog-js";

/* ─────────────────────────────────────────────
   DATA
   ───────────────────────────────────────────── */

const features = [
  {
    title: "Your honest mirror",
    desc: "Snap a photo. In ten seconds, know exactly what\u2019s working, what isn\u2019t, and one thing to change before you walk out.",
    icon: MirrorIcon,
  },
  {
    title: "Dressed for the moment",
    desc: "First date, board meeting, Saturday brunch \u2014 tell us where you\u2019re headed and the feedback fits the occasion.",
    icon: OccasionIcon,
  },
  {
    title: "Keep the conversation going",
    desc: "\u201CShould I swap the shoes?\u201D \u201CIs this too dressy?\u201D Ask follow-ups until you\u2019re sure.",
    icon: ChatIcon,
  },
  {
    title: "Your style, remembered",
    desc: "Every outfit you check builds your style profile. Over time, we learn what makes you feel like you.",
    icon: SparkleIcon,
  },
  {
    title: "Never forget a great outfit",
    desc: "That look you wore to the party everyone complimented? It\u2019s saved. Pull it up any time.",
    icon: HistoryIcon,
  },
  {
    title: "Real women, real opinions",
    desc: "Post your look to the community. Get feedback from people who actually get dressed every morning.",
    icon: CommunityIcon,
  },
];

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    featured: false,
    features: [
      "3 outfit checks per day",
      "Instant AI feedback",
      "7-day outfit history",
    ],
  },
  {
    name: "Plus",
    price: "$5.99",
    period: "per month",
    featured: true,
    features: [
      "Unlimited outfit checks",
      "Detailed feedback + Style DNA",
      "Full outfit history",
      "Unlimited follow-up questions",
      "Community access",
    ],
  },
  {
    name: "Pro",
    price: "$14.99",
    period: "per month",
    featured: false,
    features: [
      "Everything in Plus",
      "Expert stylist reviews",
      "Event outfit planning",
      "Advanced style analytics",
      "Early access to new features",
    ],
  },
];

/* ─────────────────────────────────────────────
   HOOKS
   ───────────────────────────────────────────── */

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );

    const children = el.querySelectorAll(".fade-in-up");
    children.forEach((child) => observer.observe(child));
    // Also observe the container itself if it has the class
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
  const stepsRef = useScrollReveal();
  const featuresRef = useScrollReveal();
  const proofRef = useScrollReveal();
  const pricingRef = useScrollReveal();
  const ctaRef = useScrollReveal();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollToWaitlist = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById("waitlist")?.scrollIntoView({ behavior: "smooth" });
    setMobileMenuOpen(false);
  }, []);

  return (
    <div className="min-h-screen bg-cream">
      {/* ── Nav ── */}
      <nav
        className={`nav-sticky fixed top-0 left-0 right-0 z-50 ${scrolled ? "scrolled" : ""}`}
      >
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Logo />
          <div className="hidden sm:flex items-center gap-8">
            <a href="#how" className="text-sm font-medium text-charcoal hover:text-coral transition-colors">
              How It Works
            </a>
            <a href="#features" className="text-sm font-medium text-charcoal hover:text-coral transition-colors">
              Features
            </a>
            <a href="#pricing" className="text-sm font-medium text-charcoal hover:text-coral transition-colors">
              Pricing
            </a>
            <a
              href="#waitlist"
              onClick={scrollToWaitlist}
              className="text-sm font-semibold px-5 py-2.5 rounded-full text-white bg-coral transition-all hover:bg-coral-dark"
            >
              Get Early Access
            </a>
          </div>
          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="sm:hidden p-2 text-charcoal"
            aria-label="Menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {mobileMenuOpen ? (
                <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
              ) : (
                <><line x1="3" y1="8" x2="21" y2="8" /><line x1="3" y1="16" x2="21" y2="16" /></>
              )}
            </svg>
          </button>
        </div>
        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div className="sm:hidden bg-cream border-t border-cream-dark px-6 py-4 flex flex-col gap-4">
            <a href="#how" onClick={() => setMobileMenuOpen(false)} className="text-sm font-medium text-charcoal">How It Works</a>
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="text-sm font-medium text-charcoal">Features</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="text-sm font-medium text-charcoal">Pricing</a>
            <a href="#waitlist" onClick={scrollToWaitlist} className="text-sm font-semibold px-5 py-2.5 rounded-full text-white bg-coral text-center">
              Get Early Access
            </a>
          </div>
        )}
      </nav>

      {/* ── Hero ── */}
      <section className="pt-28 sm:pt-36 pb-20 sm:pb-28" ref={heroRef}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
            {/* Left: copy */}
            <div className="flex-1 text-center lg:text-left">
              <div className="fade-in-up">
                <p className="text-sm font-medium tracking-wide uppercase mb-6 text-coral">
                  The app every closet needs
                </p>
                <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.08] mb-6 text-clarity">
                  You already know
                  <br />
                  the question.
                </h1>
                <p className="text-3xl sm:text-4xl font-display italic text-coral mb-8">
                  Or this?
                </p>
                <p className="text-lg sm:text-xl text-charcoal max-w-lg mx-auto lg:mx-0 mb-10 leading-relaxed">
                  Standing in front of the mirror, holding up two tops, running late.
                  You don&apos;t need a stylist. You need an honest answer in ten seconds.
                </p>
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

      {/* ── How It Works ── */}
      <section id="how" className="py-20 sm:py-28 bg-cream-dark" ref={stepsRef}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="fade-in-up text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-clarity mb-4">
              Three steps. Total{" "}
              <span className="font-display italic text-coral">confidence.</span>
            </h2>
            <p className="text-charcoal text-lg max-w-xl mx-auto">
              No appointments. No waiting for replies. Just you, your phone, and an answer.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-6 stagger">
            {[
              {
                num: "01",
                title: "Snap your look",
                desc: "Take a quick mirror photo or pick one from your camera roll. No perfect lighting required.",
                icon: CameraStepIcon,
              },
              {
                num: "02",
                title: "Get your verdict",
                desc: "In ten seconds: a score, what\u2019s working, what to reconsider, and one quick fix.",
                icon: FeedbackStepIcon,
              },
              {
                num: "03",
                title: "Walk out knowing",
                desc: "No more second-guessing at the door. You looked, you asked, you know.",
                icon: ConfidenceStepIcon,
              },
            ].map((step) => (
              <div key={step.num} className="fade-in-up text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-3 mb-4">
                  <span className="w-12 h-12 rounded-full bg-coral flex items-center justify-center flex-shrink-0">
                    <step.icon />
                  </span>
                  <span className="text-sm font-bold text-coral tracking-wide">{step.num}</span>
                </div>
                <h3 className="text-xl font-bold text-clarity mb-2">{step.title}</h3>
                <p className="text-charcoal leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-20 sm:py-28" ref={featuresRef}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="fade-in-up text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-clarity mb-4">
              Not another wardrobe app.
              <br />
              <span className="font-display italic text-coral">A second opinion.</span>
            </h2>
            <p className="text-charcoal text-lg max-w-xl mx-auto">
              We don&apos;t want to organize your closet. We want to make sure you
              walk out looking like you meant it.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 stagger">
            {features.map((f) => (
              <div
                key={f.title}
                className="fade-in-up card-hover p-7 rounded-2xl bg-cream-dark"
              >
                <div className="w-11 h-11 rounded-xl bg-coral/10 flex items-center justify-center mb-5">
                  <f.icon />
                </div>
                <h3 className="font-bold text-lg text-clarity mb-2">{f.title}</h3>
                <p className="text-sm text-charcoal leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Social Proof ── */}
      <section className="py-16" ref={proofRef}>
        <div className="max-w-6xl mx-auto px-6">
          <div
            className="fade-in-up rounded-3xl px-8 py-12 sm:px-12 sm:py-14"
            style={{ background: "linear-gradient(135deg, #E85D4C, #FF7A6B)" }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-6 text-center">
              <div>
                <div className="text-4xl sm:text-5xl font-bold text-white mb-2">10s</div>
                <div className="text-white/80 text-sm">Average time to feedback</div>
              </div>
              <div>
                <div className="text-4xl sm:text-5xl font-bold text-white mb-2">3</div>
                <div className="text-white/80 text-sm">Ways to get feedback:<br />AI, community, expert stylists</div>
              </div>
              <div>
                <div className="text-4xl sm:text-5xl font-bold text-white mb-2">$0</div>
                <div className="text-white/80 text-sm">To start &mdash; free forever tier</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── The "Or This?" Moment ── */}
      <section className="py-20 sm:py-28 bg-cream-dark">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
            <div className="flex-1">
              <p className="text-sm font-medium tracking-wide uppercase mb-4 text-coral">
                The signature feature
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold text-clarity mb-6 leading-tight">
                Hold up two outfits.
                <br />
                <span className="font-display italic text-coral">Let the world decide.</span>
              </h2>
              <p className="text-charcoal text-lg leading-relaxed mb-6">
                Post two options side by side. Your community votes on which one works.
                It&apos;s the question you already ask &mdash; now with an answer you can trust.
              </p>
              <ul className="flex flex-col gap-3">
                {[
                  "Side-by-side outfit comparison",
                  "Community voting in real time",
                  "See what percentage chose each look",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-charcoal">
                    <span className="w-5 h-5 rounded-full bg-coral flex items-center justify-center flex-shrink-0">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex-shrink-0">
              <ComparisonMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="py-20 sm:py-28" ref={pricingRef}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="fade-in-up text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-clarity mb-4">
              Start free. Upgrade when{" "}
              <span className="font-display italic text-coral">you&apos;re ready.</span>
            </h2>
            <p className="text-charcoal text-lg">
              No surprises. No hidden fees. Cancel anytime.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 stagger">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`fade-in-up card-hover p-7 rounded-2xl flex flex-col ${
                  plan.featured ? "border-2 border-coral bg-white glow-coral" : "bg-cream-dark"
                }`}
              >
                {plan.featured && (
                  <div className="text-xs font-bold uppercase tracking-wider mb-4 text-coral">
                    Most Popular
                  </div>
                )}
                <div className="font-bold text-xl text-clarity mb-1">{plan.name}</div>
                <div className="text-4xl font-bold text-coral mb-1">{plan.price}</div>
                <div className="text-sm text-charcoal/60 mb-7">{plan.period}</div>
                <ul className="flex flex-col gap-3 flex-1 mb-7">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-charcoal">
                      <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-coral" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href="#waitlist"
                  onClick={scrollToWaitlist}
                  className={`block text-center text-sm font-semibold py-3 rounded-xl transition-all ${
                    plan.featured
                      ? "bg-coral text-white hover:bg-coral-dark"
                      : "bg-cream text-coral hover:bg-white"
                  }`}
                >
                  Join the Waitlist
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-20 sm:py-28" ref={ctaRef}>
        <div className="max-w-5xl mx-auto px-6">
          <div
            className="fade-in-up rounded-3xl px-8 py-14 sm:px-16 sm:py-20 text-center"
            style={{ background: "linear-gradient(135deg, #E85D4C, #FF7A6B)" }}
          >
            <h2 className="text-3xl sm:text-5xl font-bold text-white mb-4 leading-tight">
              You know the feeling.
              <br />
              <span className="font-display italic">We have the answer.</span>
            </h2>
            <p className="text-white/90 text-lg mb-10 max-w-lg mx-auto">
              Join thousands of women who are done second-guessing
              and ready to walk out knowing.
            </p>
            <div className="max-w-md mx-auto">
              <WaitlistForm refCode={refCode} variant="dark" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-cream-dark py-14">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-6 mb-10">
            {/* Brand */}
            <div>
              <Logo />
              <p className="text-sm text-charcoal/60 mt-3 max-w-xs">
                Confidence in every choice.
                <br />
                Launching 2026 on Android.
              </p>
            </div>
            {/* Links */}
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
   WAITLIST FORM COMPONENT
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
    ? `I just joined the Or This? waitlist \u2014 get instant AI feedback on your outfits! Join here: ${result.referralLink}`
    : "";

  if (status === "success") {
    return (
      <div className="rounded-2xl p-7 text-center" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
        <h3 className={`text-2xl font-bold mb-1 ${variant === "dark" ? "text-white" : "text-clarity"}`}>
          {result?.alreadyJoined ? "You\u2019re already in!" : "You\u2019re on the list!"}
        </h3>
        <p className={`text-lg font-semibold mb-1 ${variant === "dark" ? "text-white/90" : "text-coral"}`}>
          Position #{result?.position}
        </p>
        <p className={`text-sm mb-5 ${variant === "dark" ? "text-white/70" : "text-charcoal/60"}`}>
          Share your link &mdash; every friend who joins moves you up 5 spots.
        </p>
        <div className="flex items-center gap-2 rounded-xl px-4 py-3 mb-4" style={{ backgroundColor: "rgba(0,0,0,0.08)" }}>
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
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-opacity hover:opacity-80 bg-charcoal/20 text-white"
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
            isDark ? "bg-white/20 text-white placeholder-white/50 border-transparent" : "bg-white border border-cream-dark text-clarity"
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
        Free to start. No credit card required. Launching on Android first.
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
   SVG ICONS (features)
   ───────────────────────────────────────────── */

function MirrorIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E85D4C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="10" r="7" />
      <path d="M8.5 20h7" />
      <path d="M12 17v3" />
    </svg>
  );
}

function OccasionIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E85D4C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4" />
      <path d="M8 2v4" />
      <path d="M3 10h18" />
      <path d="M9 16l2 2 4-4" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E85D4C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      <path d="M8 10h8" />
      <path d="M8 13h5" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E85D4C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E85D4C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function CommunityIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E85D4C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

/* Step icons (white on coral circle) */
function CameraStepIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function FeedbackStepIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function ConfidenceStepIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
    </svg>
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
              <svg width="14" height="10" viewBox="0 0 14 10" fill="#1A1A1A"><rect x="0" y="6" width="2.5" height="4" rx="0.5"/><rect x="3.5" y="4" width="2.5" height="6" rx="0.5"/><rect x="7" y="2" width="2.5" height="8" rx="0.5"/><rect x="10.5" y="0" width="2.5" height="10" rx="0.5"/></svg>
              <svg width="20" height="10" viewBox="0 0 20 10" fill="none" stroke="#1A1A1A" strokeWidth="1"><rect x="0.5" y="0.5" width="17" height="9" rx="2"/><rect x="18" y="3" width="2" height="4" rx="0.5" fill="#1A1A1A"/><rect x="2" y="2" width="12" height="6" rx="1" fill="#10B981"/></svg>
            </div>
          </div>

          {/* App content: feedback screen */}
          <div className="px-5 pb-6">
            {/* Score */}
            <div className="text-center mb-4 mt-2">
              <p className="text-[10px] text-charcoal/60 uppercase tracking-wider mb-1">Your Score</p>
              <div className="text-5xl font-bold text-[#10B981]">8.5</div>
              <p className="text-xs text-charcoal/60 mt-1">Date Night \u2022 Trendy</p>
            </div>

            {/* What's Working card */}
            <div className="bg-cream-dark rounded-xl p-3 mb-3">
              <p className="text-[10px] font-bold text-clarity mb-1.5 uppercase tracking-wide">What&apos;s Working</p>
              <p className="text-[11px] text-charcoal leading-relaxed">
                The blazer-over-dress combo is a strong choice. It adds structure and the color contrast is spot on.
              </p>
            </div>

            {/* Quick Fix card */}
            <div className="bg-coral/8 rounded-xl p-3 mb-3">
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
              <svg width="14" height="10" viewBox="0 0 14 10" fill="#1A1A1A"><rect x="0" y="6" width="2.5" height="4" rx="0.5"/><rect x="3.5" y="4" width="2.5" height="6" rx="0.5"/><rect x="7" y="2" width="2.5" height="8" rx="0.5"/><rect x="10.5" y="0" width="2.5" height="10" rx="0.5"/></svg>
              <svg width="20" height="10" viewBox="0 0 20 10" fill="none" stroke="#1A1A1A" strokeWidth="1"><rect x="0.5" y="0.5" width="17" height="9" rx="2"/><rect x="18" y="3" width="2" height="4" rx="0.5" fill="#1A1A1A"/><rect x="2" y="2" width="12" height="6" rx="1" fill="#10B981"/></svg>
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
                <div className="absolute inset-0 bg-gradient-to-b from-sage-light/50 to-sage/30" />
                <div className="relative text-center">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2D2D2D" strokeWidth="1.2" strokeLinecap="round"><path d="M12 2C8 2 6 5 6 8c0 2 .5 3 1 4l-1 8h12l-1-8c.5-1 1-2 1-4 0-3-2-6-6-6z"/><path d="M9 20v2h6v-2"/></svg>
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
                <div className="absolute inset-0 bg-gradient-to-b from-cream-dark/50 to-cream-dark" />
                <div className="relative text-center">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2D2D2D" strokeWidth="1.2" strokeLinecap="round"><rect x="6" y="4" width="12" height="8" rx="1"/><path d="M6 12l-1 8h14l-1-8"/><path d="M9 2v2h6V2"/></svg>
                  <p className="text-[9px] font-semibold text-charcoal mt-1">Blazer + Jeans</p>
                </div>
              </div>
              <div className="bg-charcoal/20 rounded-lg py-2 text-center">
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
