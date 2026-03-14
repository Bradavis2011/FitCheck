import Link from "next/link";
import { JsonLd } from "../components/JsonLd";
import { fetchLearnContent } from "../learn/api";
import type { LearnItem } from "../learn/api";

export const revalidate = 3600;

const APP_STORE_URL = "https://apps.apple.com/app/or-this/id6742406265";

const FAQS = [
  {
    question: "What should I wear postpartum?",
    answer:
      "Whatever fits your body right now and lets you move comfortably. High-waisted leggings with a flowy top, wrap dresses, and stretchy midi skirts tend to work well across the postpartum timeline. Prioritise fit and function over trend — clothes that work with your body rather than against it will always look better.",
  },
  {
    question: "What are good nursing-friendly outfit options?",
    answer:
      "Look for wrap tops, button-down shirts, and stretchy v-necks that allow easy access. Nursing-specific brands like Seraphine and Kindred Bravely make pieces designed for this, but plenty of regular clothes work just as well. Layer a cardigan or open shirt over a cami for versatility that doesn't announce 'nursing outfit.'",
  },
  {
    question: "How do I feel stylish when nothing fits the way it used to?",
    answer:
      "Buy for the body you have right now — not the one you expect to have in three months. Clothes that fit well at your current size will always look better than clothes from before that technically close but feel wrong. A well-fitted cheap piece beats an ill-fitting expensive one. This isn't a compromise; it's just dressing well.",
  },
  {
    question: "What should I avoid wearing postpartum?",
    answer:
      "Avoid anything that requires you to hold your breath, constantly adjust, or feel self-conscious about how it sits. Also avoid anything that makes feeding or changing difficult if you're in that phase. There are no rules about what to hide — wear what feels good to you.",
  },
  {
    question: "When does postpartum dressing get easier?",
    answer:
      "Usually around three to six months, when your body has settled more and you have a better sense of what fits and what doesn't. In the meantime, a small capsule of things that reliably work — even just five pieces — removes daily decision fatigue when you already have none to spare.",
  },
  {
    question: "How do I know if a postpartum outfit looks put-together?",
    answer:
      "Or This? lets you snap a photo and get an honest score out of 10 — what's working, what to adjust, whether the fit is reading the way you want. Useful when you're leaving the house and genuinely can't tell, or when you just want reassurance before you go.",
  },
];

export default async function PostpartumStylePage() {
  let articles: LearnItem[] = [];
  try {
    const data = await fetchLearnContent(undefined, "postpartum", 1, 20);
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
            { "@type": "ListItem", position: 2, name: "Postpartum Style" },
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
          Postpartum Style · Outfit Guide
        </p>
        <h1 className="font-display mb-6" style={{ fontSize: "clamp(2.25rem, 6vw, 4rem)", color: "#1A1A1A", lineHeight: 1.05 }}>
          You just had a baby.{" "}
          <span className="italic" style={{ color: "#E85D4C" }}>Getting dressed is hard enough.</span>
        </h1>
        <p className="text-xl leading-relaxed mb-10" style={{ color: "rgba(45,45,45,0.7)", maxWidth: "640px" }}>
          Your body changed. Your schedule changed. Your wardrobe hasn't caught up yet.
          Or This? gives you instant, honest feedback on outfits that actually fit —
          no pressure, no judgment, no unsolicited advice about anything.
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
            { step: "01", label: "Snap your outfit", desc: "Take a photo whenever — doesn't need to be a good photo. Thirty seconds." },
            { step: "02", label: "Add context", desc: '"Leaving the house with the baby" or "first time back at work." Context shapes the feedback.' },
            { step: "03", label: "Get an honest score", desc: "AI scores your look out of 10 with specific, actionable feedback. No vague reassurance." },
            { step: "04", label: "Feel good leaving the house", desc: "One fewer thing to second-guess. That matters more than it sounds." },
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
          Feel good leaving the house.
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
