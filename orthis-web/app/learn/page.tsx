import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "../components/JsonLd";
import LearnNav from "./components/LearnNav";
import ContentCard from "./components/ContentCard";
import StyleTipCard from "./components/StyleTipCard";
import {
  fetchLatestTrend,
  fetchLearnContent,
  fetchLearnTips,
  fetchLearnGuides,
} from "./api";

export const revalidate = 3600; // ISR: revalidate hourly

export const metadata: Metadata = {
  title: { absolute: "Style Hub — Or This? Learn" },
  description:
    "Data-backed style guides, trend reports, and fashion tips from the Or This? AI. Discover what actually works — backed by scores from real outfit checks.",
  alternates: { canonical: "/learn" },
  openGraph: {
    title: "Style Hub — Or This? Learn",
    description:
      "Data-backed style guides, trend reports, and fashion tips from the Or This? AI.",
    type: "website",
    url: "https://orthis.app/learn",
  },
};

export default async function LearnHubPage() {
  const [latestTrend, recentArticles, tips, guides] = await Promise.all([
    fetchLatestTrend(),
    fetchLearnContent(undefined, undefined, 1, 6),
    fetchLearnTips(8),
    fetchLearnGuides(),
  ]);

  const guideCategories = Object.entries(guides);
  const topGuides = guideCategories.flatMap(([, items]) => items).slice(0, 6);

  return (
    <div style={{ backgroundColor: "#FBF7F4", minHeight: "100vh" }}>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Or This? Style Hub",
          description:
            "Data-backed style guides, trend reports, and fashion tips powered by the Or This? AI outfit scoring engine.",
          url: "https://orthis.app/learn",
          publisher: { "@id": "https://orthis.app/#organization" },
          breadcrumb: {
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: "https://orthis.app" },
              { "@type": "ListItem", position: 2, name: "Learn", item: "https://orthis.app/learn" },
            ],
          },
        }}
      />

      <LearnNav activeTab="hub" />

      <div className="max-w-4xl mx-auto px-6 py-16">

        {/* Hero */}
        <header className="mb-16">
          <p className="text-xs font-medium uppercase tracking-widest mb-4" style={{ color: "#E85D4C" }}>
            Style Hub
          </p>
          <h1
            className="font-display mb-6"
            style={{ fontSize: "clamp(2.5rem, 6vw, 4rem)", color: "#1A1A1A", lineHeight: 1.05 }}
          >
            Style guides backed<br />by real data.
          </h1>
          <p className="text-lg max-w-xl" style={{ color: "rgba(45,45,45,0.65)", lineHeight: 1.7 }}>
            Or This? has scored thousands of outfits. We turned that data into guides,
            trend reports, and tips you can actually use.
          </p>
          <div style={{ width: "60px", height: "1px", backgroundColor: "#E85D4C", marginTop: "24px" }} />
        </header>

        {/* Latest trend report */}
        {latestTrend && (
          <section className="mb-16">
            <p className="text-xs font-medium uppercase tracking-widest mb-6" style={{ color: "#9B9B9B" }}>
              Latest Trend Report
            </p>
            <Link
              href={`/learn/${latestTrend.slug}`}
              style={{
                display: "block",
                backgroundColor: "#1A1A1A",
                padding: "40px",
                textDecoration: "none",
              }}
            >
              <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: "#E85D4C" }}>
                Trend Report · {latestTrend.trendPeriod || ""}
              </p>
              <h2
                className="font-display mb-4"
                style={{ fontSize: "clamp(1.5rem, 3vw, 2.25rem)", color: "#fff", lineHeight: 1.15 }}
              >
                {latestTrend.title}
              </h2>
              {latestTrend.excerpt && (
                <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
                  {latestTrend.excerpt}
                </p>
              )}
              <span
                className="text-xs font-medium uppercase tracking-wider"
                style={{ color: "#E85D4C" }}
              >
                Read the report →
              </span>
            </Link>
          </section>
        )}

        {/* Style tips grid */}
        {tips.length > 0 && (
          <section className="mb-16">
            <div className="flex items-center justify-between mb-6">
              <p className="text-xs font-medium uppercase tracking-widest" style={{ color: "#9B9B9B" }}>
                Data-Backed Style Tips
              </p>
              <Link
                href="/learn/tips"
                className="text-xs font-medium uppercase tracking-wider"
                style={{ color: "#E85D4C" }}
              >
                See all →
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {tips.slice(0, 4).map((tip) => (
                <StyleTipCard
                  key={tip.id}
                  title={tip.title}
                  slug={tip.slug}
                  excerpt={tip.excerpt}
                  category={tip.category}
                />
              ))}
            </div>
          </section>
        )}

        {/* Style guides */}
        {topGuides.length > 0 && (
          <section className="mb-16">
            <div className="flex items-center justify-between mb-6">
              <p className="text-xs font-medium uppercase tracking-widest" style={{ color: "#9B9B9B" }}>
                Style Guides
              </p>
              <Link
                href="/learn/guides"
                className="text-xs font-medium uppercase tracking-wider"
                style={{ color: "#E85D4C" }}
              >
                All guides →
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {topGuides.map((guide) => (
                <ContentCard
                  key={guide.id}
                  title={guide.title}
                  slug={guide.slug}
                  excerpt={guide.excerpt}
                  contentType={guide.contentType}
                  category={guide.category}
                  publishedAt={guide.publishedAt}
                  seoKeywords={guide.seoKeywords}
                  size="sm"
                />
              ))}
            </div>
          </section>
        )}

        {/* Recent content */}
        {recentArticles.items.length > 0 && (
          <section className="mb-16">
            <p className="text-xs font-medium uppercase tracking-widest mb-6" style={{ color: "#9B9B9B" }}>
              Recent Content
            </p>
            <div className="flex flex-col gap-4">
              {recentArticles.items.map((item) => (
                <ContentCard
                  key={item.id}
                  title={item.title}
                  slug={item.slug}
                  excerpt={item.excerpt}
                  contentType={item.contentType}
                  category={item.category}
                  publishedAt={item.publishedAt}
                  seoKeywords={item.seoKeywords}
                />
              ))}
            </div>
          </section>
        )}

        {/* App CTA */}
        <section
          style={{ backgroundColor: "#1A1A1A", padding: "48px 40px", marginTop: "40px" }}
        >
          <p className="text-xs font-medium uppercase tracking-widest mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>
            Get personalised advice
          </p>
          <h2
            className="font-display mb-4"
            style={{ fontSize: "clamp(1.5rem, 3vw, 2.25rem)", color: "#fff", lineHeight: 1.15 }}
          >
            Your outfit scored in seconds.
          </h2>
          <p className="text-sm mb-8" style={{ color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
            These guides are universal. Or This? gives you personalised feedback on your specific outfit — snap a photo, get a score out of 10, and honest style advice before you walk out the door.
          </p>
          <a
            href="https://apps.apple.com/app/or-this/id6742406265"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs font-medium uppercase tracking-wider px-8 py-4"
            style={{ backgroundColor: "#E85D4C", color: "#fff" }}
          >
            Download the App — Free
          </a>
        </section>

      </div>

      {/* Footer */}
      <footer
        className="border-t py-10 mt-8"
        style={{ borderColor: "rgba(26,26,26,0.08)", backgroundColor: "#FBF7F4" }}
      >
        <div className="max-w-4xl mx-auto px-6 flex items-center justify-between flex-wrap gap-4">
          <Link href="/" className="text-xl font-medium">
            <span className="font-sans font-medium" style={{ color: "#1A1A1A" }}>Or </span>
            <span className="font-display italic" style={{ color: "#E85D4C" }}>This?</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/journal" className="text-xs" style={{ color: "rgba(26,26,26,0.4)" }}>Journal</Link>
            <Link href="/privacy" className="text-xs" style={{ color: "rgba(26,26,26,0.4)" }}>Privacy</Link>
          </div>
          <p className="text-xs" style={{ color: "rgba(26,26,26,0.3)" }}>
            &copy; {new Date().getFullYear()} Or This?
          </p>
        </div>
      </footer>
    </div>
  );
}
