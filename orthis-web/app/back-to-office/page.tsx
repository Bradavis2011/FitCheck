import Link from "next/link";
import { JsonLd } from "../components/JsonLd";
import { fetchLearnContent } from "../learn/api";
import type { LearnItem } from "../learn/api";

export const revalidate = 3600;

const APP_STORE_URL = "https://apps.apple.com/app/or-this/id6742406265";

const FAQS = [
  {
    question: "What does business casual mean in 2026?",
    answer:
      "Post-pandemic business casual has loosened: tailored trousers with a nice blouse, a midi dress, or a structured jumpsuit all qualify. What's out: overly rigid suiting with no personality, and anything that reads like you're still in a Zoom top. The standard is polished without being stiff — put-together but not performing.",
  },
  {
    question: "What should I wear my first day back in the office?",
    answer:
      "Go slightly more dressed than you think you need to — you can always dial back. A well-fitted dress or tailored separates in a neutral palette reads reliably professional across most office cultures. Avoid anything untested: new shoes that might hurt, or an outfit you haven't worn in years without trying on first.",
  },
  {
    question: "Can I wear casual clothes back to the office?",
    answer:
      "Depends entirely on your office culture. If you're unsure, the first week isn't the time to find out. Observe what your colleagues are wearing before pushing casual. Clean, fitted casual (structured chinos, a nice knit, clean trainers in genuinely casual offices) reads better than sloppy casual regardless of the dress code.",
  },
  {
    question: "How do I rebuild a wardrobe after years of working from home?",
    answer:
      "You don't need to rebuild all at once. Start with three to five reliable pieces you can rotate: one blazer, two pairs of tailored trousers or a dress, two work-appropriate tops, one comfortable heel or loafer. Assess what you already own before buying anything new — some of it may still work perfectly.",
  },
  {
    question: "What should I not wear back to the office?",
    answer:
      "Avoid full-on athleisure (even in casual offices, leggings read as 'not trying'), anything worn and visibly past its best, overly wrinkled or poorly fitted pieces, and shoes that aren't office-appropriate for your specific environment. Also avoid dressing identically to how you dress at home — even in a casual office, a small shift signals intentionality.",
  },
  {
    question: "How can I tell if a return-to-office outfit looks right?",
    answer:
      "Or This? lets you snap a photo and get an AI score out of 10 — what reads well, what to adjust, whether the fit is working for a professional context. Useful when you genuinely can't tell anymore and don't have a trusted opinion nearby.",
  },
];

export default async function BackToOfficePage() {
  let articles: LearnItem[] = [];
  try {
    const data = await fetchLearnContent(undefined, "wfh_rto", 1, 20);
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
            { "@type": "ListItem", position: 2, name: "Return to Office Outfits" },
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
          Return to Office · Outfit Guide
        </p>
        <h1 className="font-display mb-6" style={{ fontSize: "clamp(2.25rem, 6vw, 4rem)", color: "#1A1A1A", lineHeight: 1.05 }}>
          Your wardrobe survived remote work.{" "}
          <span className="italic" style={{ color: "#E85D4C" }}>Barely.</span>
        </h1>
        <p className="text-xl leading-relaxed mb-10" style={{ color: "rgba(45,45,45,0.7)", maxWidth: "640px" }}>
          Years of Zoom tops and sweatpants will do that. Or This? gives you honest AI feedback
          on your return-to-office outfits so you show up looking like you never left.
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
            { step: "02", label: "Add context", desc: '"Returning to office after 3 years remote" — context shapes the feedback.' },
            { step: "03", label: "Get an honest score", desc: "AI scores your look out of 10. What reads professional, what doesn't, what to fix." },
            { step: "04", label: "Show up ready", desc: "No wardrobe panic on the morning commute. You already sorted it." },
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
          Look like you never left.
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
