import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "../../components/JsonLd";
import LearnNav from "../components/LearnNav";
import ContentCard from "../components/ContentCard";
import { fetchLearnContent } from "../api";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: { absolute: "Fashion Trend Reports — Or This? Learn" },
  description:
    "Weekly fashion trend reports powered by Or This? AI data. Seasonal colors, trending styles, key pieces, and what's fading — backed by real outfit scores.",
  alternates: { canonical: "/learn/trends" },
  openGraph: {
    title: "Fashion Trend Reports — Or This? Learn",
    description: "Weekly AI-powered fashion trend reports backed by real outfit data.",
    url: "https://orthis.app/learn/trends",
  },
};

export default async function LearnTrendsPage() {
  const data = await fetchLearnContent("trend_report", undefined, 1, 20);

  return (
    <div style={{ backgroundColor: "#FBF7F4", minHeight: "100vh" }}>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Fashion Trend Reports — Or This?",
          description: "Weekly fashion trend reports powered by Or This? AI data.",
          url: "https://orthis.app/learn/trends",
          publisher: { "@id": "https://orthis.app/#organization" },
        }}
      />

      <LearnNav activeTab="trends" />

      <div className="max-w-4xl mx-auto px-6 py-16">
        <header className="mb-12">
          <p className="text-xs font-medium uppercase tracking-widest mb-4" style={{ color: "#E85D4C" }}>
            Trend Reports
          </p>
          <h1
            className="font-display mb-4"
            style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", color: "#1A1A1A", lineHeight: 1.05 }}
          >
            What's trending<br />in fashion right now.
          </h1>
          <p className="text-lg max-w-xl" style={{ color: "rgba(45,45,45,0.65)", lineHeight: 1.7 }}>
            Weekly reports combining AI trend analysis with real data from outfit scores.
          </p>
          <div style={{ width: "60px", height: "1px", backgroundColor: "#E85D4C", marginTop: "24px" }} />
        </header>

        {data.items.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <p style={{ color: "#9B9B9B", fontSize: "14px" }}>
              Trend reports publish every Tuesday. Check back soon.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {data.items.map((item, i) => (
              <ContentCard
                key={item.id}
                title={item.title}
                slug={item.slug}
                excerpt={item.excerpt}
                contentType={item.contentType}
                category={item.category}
                publishedAt={item.publishedAt}
                seoKeywords={item.seoKeywords}
                size={i === 0 ? "lg" : "md"}
              />
            ))}
          </div>
        )}

        <div className="mt-12">
          <Link href="/learn" className="text-sm" style={{ color: "rgba(26,26,26,0.5)" }}>
            ← Back to Style Hub
          </Link>
        </div>
      </div>

      <footer
        className="border-t py-10 mt-8"
        style={{ borderColor: "rgba(26,26,26,0.08)", backgroundColor: "#FBF7F4" }}
      >
        <div className="max-w-4xl mx-auto px-6 flex items-center justify-between">
          <Link href="/" className="text-xl font-medium">
            <span className="font-sans font-medium" style={{ color: "#1A1A1A" }}>Or </span>
            <span className="font-display italic" style={{ color: "#E85D4C" }}>This?</span>
          </Link>
          <p className="text-xs" style={{ color: "rgba(26,26,26,0.3)" }}>
            &copy; {new Date().getFullYear()} Or This?
          </p>
        </div>
      </footer>
    </div>
  );
}
