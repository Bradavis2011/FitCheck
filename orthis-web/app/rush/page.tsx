import Link from "next/link";
import { JsonLd } from "../components/JsonLd";
import { fetchLearnContent } from "../learn/api";
import type { LearnItem } from "../learn/api";
import SiteFooter from "../components/SiteFooter";

export const revalidate = 3600;

const APP_STORE_URL = "https://apps.apple.com/app/or-this/id6742406265";

const ROUND_GUIDES = [
  { label: "Open House", slug: "what-to-wear-to-sorority-rush-open-house" },
  { label: "Philanthropy Round", slug: "philanthropy-round-outfit-ideas" },
  { label: "Sisterhood Round", slug: "sisterhood-round-outfit-sorority-rush" },
  { label: "Preference Night", slug: "what-to-wear-to-preference-night-sorority" },
  { label: "Bid Day", slug: "bid-day-outfit-ideas-sorority" },
];

const FAQS = [
  {
    question: "How many outfits do you need for rush week?",
    answer:
      "Most rush schedules run 4–7 days with 1–2 rounds per day. You'll want 6–8 distinct outfits total — one per round — so you're not repeating looks within a single house's view. Invest most in Preference Night (your nicest dress) and Open House (approachable, memorable).",
  },
  {
    question: "What should I wear to sorority rush?",
    answer:
      "Each round has its own vibe: Open House is casual-cute (sundress or jeans + blouse), Philanthropy is smart-casual, Sisterhood is business casual or cocktail-adjacent, and Preference Night is your most formal look. Always check your school's specific guidelines — SEC schools often run more formal than Big Ten.",
  },
  {
    question: "Can you wear jeans to sorority rush?",
    answer:
      "For Open House rounds, yes — a well-fitted pair of jeans with a nice top and clean shoes is perfectly acceptable and often recommended. Avoid ripped jeans or anything overly casual. For Sisterhood, Philanthropy, and Preference rounds, transition to dresses or dress pants.",
  },
  {
    question: "What does business casual mean for rush?",
    answer:
      "For rush, business casual means a midi dress, tailored jumpsuit, or blouse + dress pants. Think polished but not prom. Avoid overly casual (flip-flops, athletic wear) and overly formal (floor-length gowns). A knee-length dress or a nice co-ord set hits the mark.",
  },
  {
    question: "What should I NOT wear to sorority rush?",
    answer:
      "Avoid: logos of other sororities or Greek organizations, anything that shows too much skin for the round's formality level, uncomfortable shoes you can't walk in (you'll be on your feet all day), and outfits you're not 100% confident in. Discomfort reads on camera and in conversation.",
  },
  {
    question: "How can I tell if my rush outfit looks good?",
    answer:
      "The Or This? app lets you snap a photo of your outfit and get an honest AI score out of 10 with specific feedback — what's working, what to adjust, and how to style it better. It's like texting a fashion-forward friend, except she'll actually tell you the truth.",
  },
];

export default async function RushPage() {
  // Fetch rush-category articles from the API
  let rushArticles: LearnItem[] = [];
  try {
    const data = await fetchLearnContent(undefined, "rush", 1, 20);
    rushArticles = data.items;
  } catch {
    rushArticles = [];
  }

  return (
    <div style={{ backgroundColor: "#FBF7F4", minHeight: "100vh" }}>
      {/* Structured data */}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQS.map((faq) => ({
            "@type": "Question",
            name: faq.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: faq.answer,
            },
          })),
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "https://orthis.app" },
            { "@type": "ListItem", position: 2, name: "Sorority Rush Outfits" },
          ],
        }}
      />

      {/* Nav */}
      <nav
        className="border-b"
        style={{
          backgroundColor: "#FBF7F4",
          borderColor: "rgba(26,26,26,0.08)",
          padding: "16px 24px",
        }}
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-medium">
            <span className="font-sans font-medium" style={{ color: "#1A1A1A" }}>Or </span>
            <span className="font-display italic" style={{ color: "#E85D4C" }}>This?</span>
          </Link>
          <a
            href={APP_STORE_URL}
            className="text-xs font-medium uppercase tracking-wider px-5 py-2.5"
            style={{ backgroundColor: "#E85D4C", color: "#fff" }}
          >
            Get the App
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-16 pb-12">
        <p
          className="text-xs font-medium uppercase tracking-widest mb-4"
          style={{ color: "#E85D4C" }}
        >
          Sorority Rush · Outfit Guide
        </p>
        <h1
          className="font-display mb-6"
          style={{
            fontSize: "clamp(2.25rem, 6vw, 4rem)",
            color: "#1A1A1A",
            lineHeight: 1.05,
          }}
        >
          Stop stressing about your{" "}
          <span className="italic" style={{ color: "#E85D4C" }}>rush outfits.</span>
        </h1>
        <p
          className="text-xl leading-relaxed mb-10"
          style={{ color: "rgba(45,45,45,0.7)", maxWidth: "640px" }}
        >
          ~300,000 women go through sorority rush every year. You have 4–8 outfits to get right
          in a 5-day window. Or This? gives you instant AI feedback — know you nailed it before
          you walk into a single party.
        </p>

        <div className="flex flex-wrap gap-4 items-center">
          <a
            href={APP_STORE_URL}
            className="inline-block text-sm font-medium uppercase tracking-wider px-8 py-4"
            style={{ backgroundColor: "#E85D4C", color: "#fff" }}
          >
            Download Free — App Store
          </a>
          <a
            href="#guides"
            className="text-sm font-medium uppercase tracking-wider px-8 py-4 border"
            style={{ borderColor: "rgba(26,26,26,0.2)", color: "#1A1A1A" }}
          >
            Read the Guides
          </a>
        </div>
      </section>

      <div style={{ width: "60px", height: "1px", backgroundColor: "#E85D4C", margin: "0 auto 48px" }} />

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-6 mb-16">
        <p className="text-xs font-medium uppercase tracking-widest mb-8" style={{ color: "#9B9B9B" }}>
          How Or This? Helps
        </p>
        <div className="grid grid-cols-1 gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {[
            { step: "01", label: "Snap your outfit", desc: "Take a photo or upload from your camera roll. No special setup." },
            { step: "02", label: "Add context", desc: 'Tell it the round: "Open House" or "Preference Night." Context matters.' },
            { step: "03", label: "Get an honest score", desc: "AI scores your look out of 10 with specific feedback — what works, what to fix." },
            { step: "04", label: "Walk in confident", desc: "No second-guessing. You know exactly how your outfit reads." },
          ].map((item) => (
            <div key={item.step} className="p-6" style={{ backgroundColor: "#fff", border: "1px solid rgba(26,26,26,0.06)" }}>
              <div className="font-display text-xs italic mb-3" style={{ color: "#E85D4C" }}>{item.step}</div>
              <h3 className="font-medium mb-2 text-sm uppercase tracking-wider" style={{ color: "#1A1A1A" }}>
                {item.label}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(45,45,45,0.6)" }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Round guides */}
      <section id="guides" className="max-w-4xl mx-auto px-6 mb-16">
        <p className="text-xs font-medium uppercase tracking-widest mb-8" style={{ color: "#9B9B9B" }}>
          By Round
        </p>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {ROUND_GUIDES.map((guide) => {
            const article = rushArticles.find((a) => a.slug === guide.slug);
            if (!article) {
              // Guide not published yet — show teaser
              return (
                <div
                  key={guide.slug}
                  className="p-5 flex items-center justify-between"
                  style={{ backgroundColor: "#fff", border: "1px solid rgba(26,26,26,0.06)", opacity: 0.5 }}
                >
                  <div>
                    <div className="text-xs uppercase tracking-widest mb-1" style={{ color: "#9B9B9B" }}>
                      Style Guide
                    </div>
                    <div className="font-medium text-sm" style={{ color: "#1A1A1A" }}>
                      {guide.label}
                    </div>
                    <div className="text-xs mt-1" style={{ color: "#9B9B9B" }}>Coming soon</div>
                  </div>
                </div>
              );
            }
            return (
              <Link
                key={guide.slug}
                href={`/learn/${article.slug}`}
                className="p-5 flex items-center justify-between group"
                style={{ backgroundColor: "#fff", border: "1px solid rgba(26,26,26,0.06)" }}
              >
                <div>
                  <div className="text-xs uppercase tracking-widest mb-1" style={{ color: "#E85D4C" }}>
                    Style Guide
                  </div>
                  <div className="font-medium text-sm" style={{ color: "#1A1A1A" }}>
                    {article.title}
                  </div>
                  {article.excerpt && (
                    <div className="text-xs mt-1 leading-relaxed" style={{ color: "#9B9B9B" }}>
                      {article.excerpt.slice(0, 80)}…
                    </div>
                  )}
                </div>
                <span className="ml-4 text-lg" style={{ color: "#E85D4C" }}>→</span>
              </Link>
            );
          })}
        </div>

        {/* Additional rush articles */}
        {rushArticles.filter((a) => !ROUND_GUIDES.some((g) => g.slug === a.slug)).length > 0 && (
          <div className="mt-6">
            <p className="text-xs font-medium uppercase tracking-widest mb-4" style={{ color: "#9B9B9B" }}>
              More Rush Guides
            </p>
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
              {rushArticles
                .filter((a) => !ROUND_GUIDES.some((g) => g.slug === a.slug))
                .map((article) => (
                  <Link
                    key={article.slug}
                    href={`/learn/${article.slug}`}
                    className="p-5 flex items-center justify-between"
                    style={{ backgroundColor: "#fff", border: "1px solid rgba(26,26,26,0.06)" }}
                  >
                    <div>
                      <div className="font-medium text-sm" style={{ color: "#1A1A1A" }}>
                        {article.title}
                      </div>
                      {article.excerpt && (
                        <div className="text-xs mt-1" style={{ color: "#9B9B9B" }}>
                          {article.excerpt.slice(0, 60)}…
                        </div>
                      )}
                    </div>
                    <span className="ml-4" style={{ color: "#E85D4C" }}>→</span>
                  </Link>
                ))}
            </div>
          </div>
        )}
      </section>

      {/* App CTA banner */}
      <section
        className="max-w-4xl mx-auto px-6 mb-16 py-12 px-10"
        style={{ backgroundColor: "#1A1A1A" }}
      >
        <p className="text-xs uppercase tracking-widest mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>
          Get instant AI feedback
        </p>
        <h2
          className="font-display mb-4"
          style={{ color: "#fff", fontSize: "clamp(1.5rem, 4vw, 2.5rem)", lineHeight: 1.1 }}
        >
          Know you nailed it before you walk in.
        </h2>
        <p className="text-sm mb-8 leading-relaxed" style={{ color: "rgba(255,255,255,0.55)", maxWidth: "500px" }}>
          Snap your outfit, pick the round, get a score out of 10 with specific feedback.
          Free to download. No social media required.
        </p>
        <a
          href={APP_STORE_URL}
          className="inline-block text-sm font-medium uppercase tracking-wider px-8 py-4"
          style={{ backgroundColor: "#E85D4C", color: "#fff" }}
        >
          Download on the App Store — Free
        </a>
      </section>

      {/* FAQ */}
      <section className="max-w-4xl mx-auto px-6 mb-16">
        <p className="text-xs font-medium uppercase tracking-widest mb-8" style={{ color: "#9B9B9B" }}>
          Common Questions
        </p>
        <div className="space-y-0">
          {FAQS.map((faq, i) => (
            <div
              key={i}
              className="py-6"
              style={{ borderBottom: "1px solid rgba(26,26,26,0.08)" }}
            >
              <h3 className="font-medium mb-3" style={{ color: "#1A1A1A", fontSize: "1rem" }}>
                {faq.question}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(45,45,45,0.65)" }}>
                {faq.answer}
              </p>
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
