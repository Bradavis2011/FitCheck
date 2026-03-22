import Link from "next/link";
import { JsonLd } from "../components/JsonLd";
import { fetchLearnContent } from "../learn/api";
import type { LearnItem } from "../learn/api";
import SiteFooter from "../components/SiteFooter";

export const revalidate = 3600;

const APP_STORE_URL = "https://apps.apple.com/app/or-this/id6742406265";

const FAQS = [
  {
    question: "What should I wear my first week back at work after having kids?",
    answer:
      "Stick to a small rotation of pieces you feel genuinely comfortable in — not outfits you think you 'should' wear. A well-fitted blazer over simple separates, or a structured midi dress, reads professional without requiring you to overthink it. Prioritise fit above everything else: clothes that fit your body right now, not your pre-baby body or some future version of yourself.",
  },
  {
    question: "How do I rebuild a work wardrobe on a budget?",
    answer:
      "Start with five core pieces: one blazer, two pairs of well-fitted trousers or a skirt, two blouses. LOFT, Banana Republic Factory, and Target's A New Day line are worth checking. Poshmark and ThredUp have professional pieces for a fraction of retail. You don't need a full wardrobe immediately — build it over two to three pay cycles.",
  },
  {
    question: "Are my old work clothes still appropriate?",
    answer:
      "Maybe. If they fit well and the style hasn't dated dramatically, yes. If they're more than four or five years old, check the silhouette: overly structured shoulders, very boxy cuts, or certain fabric weights can read dated. Try them on with fresh eyes — or better yet, snap a photo in Or This? for an honest score.",
  },
  {
    question: "What's a good capsule wardrobe for returning to work?",
    answer:
      "A practical returning-to-work capsule: one neutral blazer, two tailored trousers (one black, one navy or tan), two fitted blouses, one midi dress that works alone or under a blazer, and one pair of comfortable block-heel or loafer-style shoes. That gives you ten-plus distinct looks without decision fatigue every morning.",
  },
  {
    question: "How do I know if an outfit looks professional enough?",
    answer:
      "The honest answer: it's hard to self-assess. You're too close to it, and mirrors don't show how you move. Or This? lets you snap a photo and get an AI score out of 10 with specific feedback — what reads well, what to adjust, whether the fit is working. It's like asking a friend who'll actually tell you the truth.",
  },
  {
    question: "How do I feel confident when I'm out of practice dressing for work?",
    answer:
      "Confidence comes from preparation, not perfection. Do one or two test runs before your first day — put together the outfit, take a photo, assess it calmly. The goal is feeling settled in your clothes, not performing some version of yourself you no longer are. Wear things that feel like you, not things that feel like who you were before kids.",
  },
];

export default async function BackToWorkPage() {
  let articles: LearnItem[] = [];
  try {
    const data = await fetchLearnContent(undefined, "sahm_rto", 1, 20);
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
            { "@type": "ListItem", position: 2, name: "Back to Work Outfits" },
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
          Back to Work · Outfit Guide
        </p>
        <h1 className="font-display mb-6" style={{ fontSize: "clamp(2.25rem, 6vw, 4rem)", color: "#1A1A1A", lineHeight: 1.05 }}>
          Back to work.{" "}
          <span className="italic" style={{ color: "#E85D4C" }}>Back to you.</span>
        </h1>
        <p className="text-xl leading-relaxed mb-10" style={{ color: "rgba(45,45,45,0.7)", maxWidth: "640px" }}>
          Returning to the workplace after time at home is a big transition — and your wardrobe
          probably hasn't kept up. Or This? gives you honest AI feedback so you walk in on day
          one feeling like yourself, not like you're playing dress-up.
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
            { step: "01", label: "Snap your outfit", desc: "Take a photo or upload from your camera roll. No setup, no account required to try it." },
            { step: "02", label: "Add context", desc: 'Tell it the situation: "First week back at work" or "job interview." Context shapes the feedback.' },
            { step: "03", label: "Get an honest score", desc: "AI scores your look out of 10 — what reads well, what to adjust, whether the fit is working." },
            { step: "04", label: "Walk in settled", desc: "No second-guessing on the morning commute. You already know how your outfit reads." },
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
          Know you look the part before day one.
        </h2>
        <p className="text-sm mb-8 leading-relaxed" style={{ color: "rgba(255,255,255,0.55)", maxWidth: "500px" }}>
          Snap your outfit, add context, get a score out of 10 with specific feedback. Free to download. No judgment.
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

      {/* More Style Guides */}
      <section className="max-w-4xl mx-auto px-6 mb-12">
        <p className="text-xs font-medium uppercase tracking-widest mb-6" style={{ color: "#9B9B9B" }}>More Style Guides</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {[
            { href: "/back-to-work", label: "Back to Work" },
            { href: "/back-to-office", label: "Back to Office" },
            { href: "/dating-again", label: "Dating Again" },
            { href: "/postpartum-style", label: "Postpartum Style" },
            { href: "/career-change", label: "Career Change" },
            { href: "/reinvention", label: "Style Reinvention" },
            { href: "/rush", label: "Sorority Rush" },
            { href: "/try", label: "Score Your Outfit" },
            { href: "/learn", label: "Style Hub" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs font-medium uppercase tracking-wider px-4 py-2"
              style={{ border: "1px solid rgba(26,26,26,0.15)", color: "rgba(26,26,26,0.6)" }}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
