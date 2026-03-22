import Link from "next/link";
import { JsonLd } from "../components/JsonLd";
import { fetchLearnContent } from "../learn/api";
import type { LearnItem } from "../learn/api";
import SiteFooter from "../components/SiteFooter";

export const revalidate = 3600;

const APP_STORE_URL = "https://apps.apple.com/app/or-this/id6742406265";

const FAQS = [
  {
    question: "How do I find my style again after a major life change?",
    answer:
      "Start by wearing what you actually reach for — not what you think you should wear now. Your genuine style is already there; it just needs permission to show up. Notice what makes you feel like yourself, not what's trending or what other women your age wear. Style reinvention isn't a project. It's a series of small honest choices.",
  },
  {
    question: "Is there such a thing as age-appropriate dressing?",
    answer:
      "No — at least not the way the phrase is usually meant. 'Age-appropriate' is often just a way of telling women to take up less space. Wear what you want. The only real rule is fit: clothes that fit your actual body will always look better than any specific style formula. After that, wear whatever you like.",
  },
  {
    question: "How do I update my wardrobe without starting from scratch?",
    answer:
      "Start with an edit, not a haul. Try everything on and be honest: does this still feel like me? Does it fit right now? Keep what passes both tests. Then identify two or three things that are actually missing — a better-fitting blazer, a dress you feel great in — and buy those specifically. Targeted beats wholesale every time.",
  },
  {
    question: "What are good style starting points for midlife reinvention?",
    answer:
      "Think about the impression you want to make on yourself, not on anyone else. Strong silhouettes tend to read well regardless of trend cycles. Quality over quantity at this point in life is usually the right call. And neutrals build a reliable base — but don't confuse reliable with dull. Your wardrobe should feel like you, not like a uniform.",
  },
  {
    question: "How do I dress for my body now, not the one I used to have?",
    answer:
      "Fit is the whole answer. Clothes that fit the body you have today will look dramatically better than clothes sized for who you were five years ago. Get things tailored if needed — it's not expensive and it makes an enormous difference. Dressing your actual body isn't a consolation prize; it's just how dressing well works.",
  },
  {
    question: "How do I know if an outfit actually looks good on me?",
    answer:
      "Or This? lets you snap a photo and get an honest score out of 10 — what's working, what to adjust, whether the fit is landing the way you want. There's no social component, no voting, no audience. Just straight feedback so you can make the call yourself.",
  },
];

export default async function ReinventionPage() {
  let articles: LearnItem[] = [];
  try {
    const data = await fetchLearnContent(undefined, "reinvention", 1, 20);
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
            { "@type": "ListItem", position: 2, name: "Style Reinvention" },
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
          Style Reinvention · Outfit Guide
        </p>
        <h1 className="font-display mb-6" style={{ fontSize: "clamp(2.25rem, 6vw, 4rem)", color: "#1A1A1A", lineHeight: 1.05 }}>
          You&apos;re not the same person you were.{" "}
          <span className="italic" style={{ color: "#E85D4C" }}>Your wardrobe shouldn&apos;t be either.</span>
        </h1>
        <p className="text-xl leading-relaxed mb-10" style={{ color: "rgba(45,45,45,0.7)", maxWidth: "640px" }}>
          Post-divorce, post-kids, post-whatever-it-was — this is your chapter. Or This? helps
          you figure out what your style actually is now, with honest AI feedback on every outfit.
          No rules about what women your age are supposed to wear.
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
            { step: "01", label: "Snap your outfit", desc: "Take a photo of whatever you're considering. No setup, no account required." },
            { step: "02", label: "Add context", desc: '"Dinner with friends" or "reinventing my style after 40." Context makes the feedback useful.' },
            { step: "03", label: "Get an honest score", desc: "A score out of 10 with specific feedback — what works, what doesn't, what to try instead." },
            { step: "04", label: "Dress like yourself", desc: "Honest feedback helps you find what actually works. That's the whole point." },
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
          Dress like this chapter.
        </h2>
        <p className="text-sm mb-8 leading-relaxed" style={{ color: "rgba(255,255,255,0.55)", maxWidth: "500px" }}>
          Snap your outfit, get a score out of 10 with specific feedback. Free to download. No judgment, no rules.
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
