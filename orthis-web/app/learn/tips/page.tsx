import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "../../components/JsonLd";
import LearnNav from "../components/LearnNav";
import StyleTipCard from "../components/StyleTipCard";
import { fetchLearnContent } from "../api";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: { absolute: "Data-Backed Style Tips — Or This? Learn" },
  description:
    "Style tips backed by real outfit data. Every tip comes from patterns discovered in thousands of outfit scores by the Or This? AI.",
  alternates: { canonical: "/learn/tips" },
  openGraph: {
    title: "Data-Backed Style Tips — Or This? Learn",
    description: "Style tips backed by real outfit scores. No opinions — just data.",
    url: "https://orthis.app/learn/tips",
  },
};

const categoryOrder = ["color", "fit", "proportion", "occasion_matching", "texture", "layering"];

export default async function LearnTipsPage() {
  const data = await fetchLearnContent("style_tip", undefined, 1, 50);

  // Group by category
  const grouped: Record<string, typeof data.items> = {};
  for (const item of data.items) {
    const key = item.category || "general";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  }

  // Sort categories
  const categories = [
    ...categoryOrder.filter((c) => grouped[c]),
    ...Object.keys(grouped).filter((c) => !categoryOrder.includes(c)),
  ];

  return (
    <div style={{ backgroundColor: "#FBF7F4", minHeight: "100vh" }}>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Data-Backed Style Tips — Or This?",
          description:
            "Style tips discovered from patterns in thousands of outfit scores.",
          url: "https://orthis.app/learn/tips",
          publisher: { "@id": "https://orthis.app/#organization" },
        }}
      />

      <LearnNav activeTab="tips" />

      <div className="max-w-4xl mx-auto px-6 py-16">
        <header className="mb-12">
          <p className="text-xs font-medium uppercase tracking-widest mb-4" style={{ color: "#E85D4C" }}>
            Style Tips
          </p>
          <h1
            className="font-display mb-4"
            style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", color: "#1A1A1A", lineHeight: 1.05 }}
          >
            What the data<br />actually says.
          </h1>
          <p className="text-lg max-w-xl" style={{ color: "rgba(45,45,45,0.65)", lineHeight: 1.7 }}>
            Every tip here was discovered by our AI scoring real outfits —
            not fashion opinion, just statistically significant patterns.
          </p>
          <div style={{ width: "60px", height: "1px", backgroundColor: "#E85D4C", marginTop: "24px" }} />
        </header>

        {data.items.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <p style={{ color: "#9B9B9B", fontSize: "14px" }}>
              Style tips generate weekly as our AI discovers new patterns.
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
                    {category.replace(/_/g, " ")}
                  </h2>
                  <span className="text-xs" style={{ color: "rgba(26,26,26,0.3)" }}>
                    {grouped[category].length} tip{grouped[category].length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {grouped[category].map((tip) => (
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
            ))}
          </div>
        )}

        {/* Not gated — tips are short conversion hooks */}
        <div
          className="mt-16 py-10 px-8"
          style={{ backgroundColor: "#1A1A1A" }}
        >
          <p
            className="text-xs uppercase tracking-widest mb-4"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >
            See how your outfit actually scores
          </p>
          <h2
            className="font-display mb-4"
            style={{ color: "#fff", fontSize: "1.75rem", lineHeight: 1.2 }}
          >
            These tips are universal.<br />Or This? is personal.
          </h2>
          <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
            Snap a photo of your actual outfit and get a score out of 10 with specific, honest feedback in seconds.
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
        </div>

        <div className="mt-8">
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
