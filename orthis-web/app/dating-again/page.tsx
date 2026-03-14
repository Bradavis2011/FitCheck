import Link from "next/link";
import { JsonLd } from "../components/JsonLd";
import { fetchLearnContent } from "../learn/api";
import type { LearnItem } from "../learn/api";

export const revalidate = 3600;

const APP_STORE_URL = "https://apps.apple.com/app/or-this/id6742406265";

const FAQS = [
  {
    question: "What should I wear on a first date after divorce?",
    answer:
      "Wear something you already own and already feel good in — not something you bought specifically for this date. The goal is to feel like yourself, not to perform a version of yourself. A dress or jeans-and-a-top that fits well and feels familiar will read better than something new that you're still adjusting to. Comfort and confidence are visible.",
  },
  {
    question: "How dressy should a first date outfit be?",
    answer:
      "Match the venue, not your anxiety. A casual coffee date doesn't need a cocktail dress. A dinner date doesn't need anything formal. When in doubt: smart casual — well-fitted jeans, a nice top, clean shoes. The right amount of effort signals you care without making it feel like a job interview.",
  },
  {
    question: "What should I avoid wearing on a first date?",
    answer:
      "Avoid anything you're not comfortable in — new shoes that hurt, a top that keeps sliding, anything you need to adjust constantly. Also avoid outfits that feel like a costume: too far from your day-to-day style, trying to signal something you're not. The best outfit is the one you stop thinking about once you leave the house.",
  },
  {
    question: "How do I feel like myself again when dressing for dates?",
    answer:
      "Start by taking stock of what you actually wear — not what's in your wardrobe, but what you reach for. Your real style is already in there. Build from that instead of trying to start fresh. You don't need a new wardrobe to date again; you need clothes that reflect who you actually are right now.",
  },
  {
    question: "Is it okay to wear the same style I always have, or should I update my look?",
    answer:
      "There's no obligation to update. If your style feels like you, wear it. If you've changed and your wardrobe hasn't kept up, a few well-chosen pieces can close the gap — but that's optional, not required. Dating after divorce is already a lot. Your outfit doesn't need to be a reinvention project.",
  },
  {
    question: "How can I tell if my date outfit looks good?",
    answer:
      "Ask someone who'll be honest — or use Or This?. Snap a photo of your outfit and get an AI score out of 10 with specific feedback on fit, balance, and overall impression. It takes thirty seconds and removes the guesswork. Show up knowing how you look instead of wondering.",
  },
];

export default async function DatingAgainPage() {
  let articles: LearnItem[] = [];
  try {
    const data = await fetchLearnContent(undefined, "dating_restart", 1, 20);
    articles = data.items;
  } catch {
    articles = [];
  }

  return (
    <div style={{ backgroundColor: "#FBF7F4", minHeight: "100vh" }}>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQS.map((faq) => ({
            "@type": "Question",
            name: faq.question,
            acceptedAnswer: { "@type": "Answer", text: faq.answer },
          })),
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "https://orthis.app" },
            { "@type": "ListItem", position: 2, name: "First Date Outfits After Divorce" },
          ],
        }}
      />

      {/* Nav */}
      <nav className="border-b" style={{ backgroundColor: "#FBF7F4", borderColor: "rgba(26,26,26,0.08)", padding: "16px 24px" }}>
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-medium">
            <span className="font-sans font-medium" style={{ color: "#1A1A1A" }}>Or </span>
            <span className="font-display italic" style={{ color: "#E85D4C" }}>This?</span>
          </Link>
          <a href={APP_STORE_URL} className="text-xs font-medium uppercase tracking-wider px-5 py-2.5" style={{ backgroundColor: "#E85D4C", color: "#fff" }}>
            Get the App
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-16 pb-12">
        <p className="text-xs font-medium uppercase tracking-widest mb-4" style={{ color: "#E85D4C" }}>
          Dating Again · Outfit Guide
        </p>
        <h1 className="font-display mb-6" style={{ fontSize: "clamp(2.25rem, 6vw, 4rem)", color: "#1A1A1A", lineHeight: 1.05 }}>
          Your first date.{" "}
          <span className="italic" style={{ color: "#E85D4C" }}>Your terms.</span>
        </h1>
        <p className="text-xl leading-relaxed mb-10" style={{ color: "rgba(45,45,45,0.7)", maxWidth: "640px" }}>
          Dating again after a divorce or long relationship is already a lot.
          Your outfit should be the last thing you're thinking about. Or This? gives you honest
          AI feedback — confidence first, no judgment, no noise.
        </p>
        <div className="flex flex-wrap gap-4 items-center">
          <a href={APP_STORE_URL} className="inline-block text-sm font-medium uppercase tracking-wider px-8 py-4" style={{ backgroundColor: "#E85D4C", color: "#fff" }}>
            Download Free — App Store
          </a>
          <a href="#guides" className="text-sm font-medium uppercase tracking-wider px-8 py-4 border" style={{ borderColor: "rgba(26,26,26,0.2)", color: "#1A1A1A" }}>
            Read the Guides
          </a>
        </div>
      </section>

      <div style={{ width: "60px", height: "1px", backgroundColor: "#E85D4C", margin: "0 auto 48px" }} />

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-6 mb-16">
        <p className="text-xs font-medium uppercase tracking-widest mb-8" style={{ color: "#9B9B9B" }}>How Or This? Helps</p>
        <div className="grid grid-cols-1 gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {[
            { step: "01", label: "Snap your outfit", desc: "Take a photo or upload from your camera roll. Thirty seconds." },
            { step: "02", label: "Add context", desc: '"First date — casual dinner" or "coffee date." The AI adjusts its feedback to the situation.' },
            { step: "03", label: "Get an honest score", desc: "A score out of 10, what's working, and what to change. Specific, not vague." },
            { step: "04", label: "Go in as yourself", desc: "You already know how you look. One less thing to wonder about." },
          ].map((item) => (
            <div key={item.step} className="p-6" style={{ backgroundColor: "#fff", border: "1px solid rgba(26,26,26,0.06)" }}>
              <div className="font-display text-xs italic mb-3" style={{ color: "#E85D4C" }}>{item.step}</div>
              <h3 className="font-medium mb-2 text-sm uppercase tracking-wider" style={{ color: "#1A1A1A" }}>{item.label}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(45,45,45,0.6)" }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Articles */}
      {articles.length > 0 && (
        <section id="guides" className="max-w-4xl mx-auto px-6 mb-16">
          <p className="text-xs font-medium uppercase tracking-widest mb-8" style={{ color: "#9B9B9B" }}>Style Guides</p>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
            {articles.map((article) => (
              <Link key={article.slug} href={`/learn/${article.slug}`} className="p-5 flex items-center justify-between" style={{ backgroundColor: "#fff", border: "1px solid rgba(26,26,26,0.06)" }}>
                <div>
                  <div className="text-xs uppercase tracking-widest mb-1" style={{ color: "#E85D4C" }}>Style Guide</div>
                  <div className="font-medium text-sm" style={{ color: "#1A1A1A" }}>{article.title}</div>
                  {article.excerpt && <div className="text-xs mt-1 leading-relaxed" style={{ color: "#9B9B9B" }}>{article.excerpt.slice(0, 80)}…</div>}
                </div>
                <span className="ml-4" style={{ color: "#E85D4C" }}>→</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 mb-16 py-12 px-10" style={{ backgroundColor: "#1A1A1A" }}>
        <p className="text-xs uppercase tracking-widest mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>Get instant AI feedback</p>
        <h2 className="font-display mb-4" style={{ color: "#fff", fontSize: "clamp(1.5rem, 4vw, 2.5rem)", lineHeight: 1.1 }}>
          Show up knowing how you look.
        </h2>
        <p className="text-sm mb-8 leading-relaxed" style={{ color: "rgba(255,255,255,0.55)", maxWidth: "500px" }}>
          Snap your outfit, get a score out of 10 with specific feedback. Free to download. No judgment.
        </p>
        <a href={APP_STORE_URL} className="inline-block text-sm font-medium uppercase tracking-wider px-8 py-4" style={{ backgroundColor: "#E85D4C", color: "#fff" }}>
          Download on the App Store — Free
        </a>
      </section>

      {/* FAQ */}
      <section className="max-w-4xl mx-auto px-6 mb-16">
        <p className="text-xs font-medium uppercase tracking-widest mb-8" style={{ color: "#9B9B9B" }}>Common Questions</p>
        <div className="space-y-0">
          {FAQS.map((faq, i) => (
            <div key={i} className="py-6" style={{ borderBottom: "1px solid rgba(26,26,26,0.08)" }}>
              <h3 className="font-medium mb-3" style={{ color: "#1A1A1A", fontSize: "1rem" }}>{faq.question}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(45,45,45,0.65)" }}>{faq.answer}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-10" style={{ borderColor: "rgba(26,26,26,0.08)", backgroundColor: "#FBF7F4" }}>
        <div className="max-w-4xl mx-auto px-6 flex items-center justify-between flex-wrap gap-4">
          <Link href="/" className="text-xl font-medium">
            <span className="font-sans font-medium" style={{ color: "#1A1A1A" }}>Or </span>
            <span className="font-display italic" style={{ color: "#E85D4C" }}>This?</span>
          </Link>
          <div className="flex gap-6 text-xs uppercase tracking-wider" style={{ color: "rgba(26,26,26,0.4)" }}>
            <Link href="/learn">Style Hub</Link>
            <Link href="/privacy">Privacy</Link>
          </div>
          <p className="text-xs" style={{ color: "rgba(26,26,26,0.3)" }}>&copy; {new Date().getFullYear()} Or This?</p>
        </div>
      </footer>
    </div>
  );
}
