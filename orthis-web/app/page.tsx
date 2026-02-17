import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FBF7F4" }}>
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto">
        <Logo />
        <div className="flex items-center gap-6">
          <a href="#features" className="text-sm font-medium text-[#2D2D2D] hover:text-[#E85D4C] transition-colors hidden sm:block">Features</a>
          <a href="#pricing" className="text-sm font-medium text-[#2D2D2D] hover:text-[#E85D4C] transition-colors hidden sm:block">Pricing</a>
          <a
            href="#download"
            className="text-sm font-semibold px-4 py-2 rounded-full text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#E85D4C" }}
          >
            Download
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
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4" id="download">
          <a
            href="https://apps.apple.com/app/or-this/id000000000"
            className="flex items-center gap-3 px-6 py-3 rounded-2xl text-white font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#1A1A1A" }}
          >
            <AppleIcon />
            <span>Download on App Store</span>
          </a>
          <a
            href="https://play.google.com/store/apps/details?id=com.bradavis.orthis"
            className="flex items-center gap-3 px-6 py-3 rounded-2xl text-white font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#1A1A1A" }}
          >
            <GooglePlayIcon />
            <span>Get it on Google Play</span>
          </a>
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
          <p className="text-white/90 text-lg mb-8">Free to start. No credit card required.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://apps.apple.com/app/or-this/id000000000"
              className="flex items-center gap-3 px-6 py-3 rounded-2xl font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#1A1A1A", color: "#fff" }}
            >
              <AppleIcon />
              <span>App Store</span>
            </a>
            <a
              href="https://play.google.com/store/apps/details?id=com.bradavis.orthis"
              className="flex items-center gap-3 px-6 py-3 rounded-2xl font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#1A1A1A", color: "#fff" }}
            >
              <GooglePlayIcon />
              <span>Google Play</span>
            </a>
          </div>
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

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
  );
}

function GooglePlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 20.5v-17c0-.83.94-1.3 1.6-.8l14 8.5c.6.37.6 1.23 0 1.6l-14 8.5c-.66.5-1.6.03-1.6-.8z"/>
    </svg>
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
