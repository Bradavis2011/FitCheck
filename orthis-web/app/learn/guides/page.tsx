import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "../../components/JsonLd";
import LearnNav from "../components/LearnNav";
import ContentCard from "../components/ContentCard";
import { fetchLearnGuides } from "../api";

export const revalidate = 86400; // guides are near-static cornerstone content

export const metadata: Metadata = {
  title: { absolute: "Style Guides — Or This? Learn" },
  description:
    "Complete style guides: color theory, fit, body types, occasions, and 30+ aesthetic archetypes. Data-backed advice from the Or This? AI outfit scoring engine.",
  alternates: { canonical: "/learn/guides" },
  openGraph: {
    title: "Style Guides — Or This? Learn",
    description: "Complete, data-backed style guides for every occasion and aesthetic.",
    url: "https://orthis.app/learn/guides",
  },
};

const categoryLabels: Record<string, string> = {
  "color-theory": "Color Theory",
  "fit-guide": "Fit Guides",
  "occasion-guide": "Occasion Guides",
  "archetype-guide": "Style Archetypes",
  general: "General",
};

export default async function LearnGuidesPage() {
  const guides = await fetchLearnGuides();
  const categories = Object.keys(guides);

  const totalGuides = categories.reduce((sum, cat) => sum + guides[cat].length, 0);

  return (
    <div style={{ backgroundColor: "#FBF7F4", minHeight: "100vh" }}>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Style Guides — Or This?",
          description: "Complete style guides for every occasion, aesthetic, and body type.",
          url: "https://orthis.app/learn/guides",
          publisher: { "@id": "https://orthis.app/#organization" },
        }}
      />

      <LearnNav activeTab="guides" />

      <div className="max-w-4xl mx-auto px-6 py-16">
        <header className="mb-12">
          <p className="text-xs font-medium uppercase tracking-widest mb-4" style={{ color: "#E85D4C" }}>
            Style Guides
          </p>
          <h1
            className="font-display italic mb-4"
            style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", color: "#1A1A1A", lineHeight: 1.05 }}
          >
            The complete style<br />reference library.
          </h1>
          <p className="text-lg max-w-xl" style={{ color: "rgba(45,45,45,0.65)", lineHeight: 1.7 }}>
            {totalGuides > 0
              ? `${totalGuides} guides covering every occasion, aesthetic, and fit principle.`
              : "Comprehensive guides covering every occasion, aesthetic, and fit principle."}
          </p>
          <div style={{ width: "60px", height: "1px", backgroundColor: "#E85D4C", marginTop: "24px" }} />
        </header>

        {categories.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <p style={{ color: "#9B9B9B", fontSize: "14px" }}>
              Style guides are being generated. Check back soon — or{" "}
              <Link href="https://orthis.app#waitlist" style={{ color: "#E85D4C" }}>
                join the waitlist
              </Link>{" "}
              to be notified.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-12">
            {categories.map((category) => (
              <section key={category}>
                <div
                  className="flex items-center gap-4 mb-6 pb-4"
                  style={{ borderBottom: "1px solid rgba(26,26,26,0.08)" }}
                >
                  <h2
                    className="text-xs font-medium uppercase tracking-widest"
                    style={{ color: "#9B9B9B" }}
                  >
                    {categoryLabels[category] || category.replace(/-/g, " ")}
                  </h2>
                  <span className="text-xs" style={{ color: "rgba(26,26,26,0.3)" }}>
                    {guides[category].length} guide{guides[category].length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {guides[category].map((guide) => (
                    <ContentCard
                      key={guide.id}
                      title={guide.title}
                      slug={guide.slug}
                      excerpt={guide.excerpt}
                      contentType={guide.contentType}
                      category={guide.category}
                      publishedAt={guide.publishedAt}
                      seoKeywords={guide.seoKeywords}
                    />
                  ))}
                </div>
              </section>
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
            <span style={{ color: "#1A1A1A" }}>Or </span>
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
