import Link from "next/link";
import { JsonLd } from "../components/JsonLd";
import { fetchLearnContent } from "../learn/api";
import type { LearnItem } from "../learn/api";

export const revalidate = 3600;

const APP_STORE_URL = "https://apps.apple.com/app/or-this/id6742406265";

const FAQS = [
  {
    question: "What should I wear for a career change interview?",
    answer:
      "Research the industry's dress code before the interview — not just the company. Creative and tech roles often skew smart casual; finance and law still tend formal. When in doubt, go one level above what you think the day-to-day dress code is. Being slightly overdressed for an interview reads as intentional; being underdressed reads as unprepared.",
  },
  {
    question: "How do I read a new industry's dress code?",
    answer:
      "Look at the company's LinkedIn photos, their social media, and any public-facing videos. Glassdoor reviews sometimes mention dress code directly. If you know anyone in the industry, ask. The goal is to look like you could already work there — not like you're trying to look like a different version of yourself.",
  },
  {
    question: "What should I wear my first day in a new career?",
    answer:
      "Match what you observed during the interview process, or slightly above it. Your first day isn't the time to experiment. A reliable, well-fitted outfit you've worn before will serve you better than something new you're still getting used to. You have enough to think about without your clothes adding to it.",
  },
  {
    question: "How do I build a wardrobe for a new industry on a budget?",
    answer:
      "Identify three to five core pieces that work for the new dress code and start there. LOFT, Banana Republic Factory, and Uniqlo hit the sweet spot of professional and affordable. Poshmark and ThredUp have quality pieces for much less. You don't need a full wardrobe overhaul immediately — build strategically over time.",
  },
  {
    question: "Does what I wear to an interview actually matter?",
    answer:
      "Yes — but not in the way most people think. It's not about looking impressive; it's about not looking out of place. An outfit that fits the culture removes a potential distraction from what you're actually saying. The goal is for your clothes to disappear into the background so your competence is what registers.",
  },
  {
    question: "How can I tell if my interview outfit is right for the role?",
    answer:
      "Or This? lets you snap a photo and get an AI score out of 10 — what reads well, what to adjust, and whether the overall look fits the professional context you describe. Useful when you're genuinely unsure and don't have someone who knows the industry to ask.",
  },
];

export default async function CareerChangePage() {
  let articles: LearnItem[] = [];
  try {
    const data = await fetchLearnContent(undefined, "career_change", 1, 20);
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
            { "@type": "ListItem", position: 2, name: "Career Change Outfits" },
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
          Career Change · Outfit Guide
        </p>
        <h1 className="font-display mb-6" style={{ fontSize: "clamp(2.25rem, 6vw, 4rem)", color: "#1A1A1A", lineHeight: 1.05 }}>
          New chapter.{" "}
          <span className="italic" style={{ color: "#E85D4C" }}>New wardrobe.</span>
        </h1>
        <p className="text-xl leading-relaxed mb-10" style={{ color: "rgba(45,45,45,0.7)", maxWidth: "640px" }}>
          Pivoting careers means reading a new dress code from scratch — and getting it wrong
          in week one is memorable for the wrong reasons. Or This? gives you honest AI feedback
          on your interview and first-day outfits so you show up looking like you already belong.
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
            { step: "01", label: "Snap your outfit", desc: "Photo or camera roll upload. No account needed to try it." },
            { step: "02", label: "Add context", desc: '"Job interview at a tech startup" or "first day in finance." Context shapes the feedback.' },
            { step: "03", label: "Get an honest score", desc: "AI scores your look out of 10 — does it fit the industry, the role, the level of formality?" },
            { step: "04", label: "Start strong", desc: "One less variable on a day when you're already thinking about everything else." },
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
          Show up looking like you belong.
        </h2>
        <p className="text-sm mb-8 leading-relaxed" style={{ color: "rgba(255,255,255,0.55)", maxWidth: "500px" }}>
          Snap your outfit, get a score out of 10 with specific feedback. Free to download.
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
