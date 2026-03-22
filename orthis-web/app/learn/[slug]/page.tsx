import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "../../components/JsonLd";
import LearnNav from "../components/LearnNav";
import ContentGate from "../components/ContentGate";
import MarkdownRenderer from "../components/MarkdownRenderer";
import { fetchLearnContentBySlug, fetchLearnContent, fetchRelatedContent } from "../api";
import ContentCard from "../components/ContentCard";

export const revalidate = 3600;

interface Props {
  params: Promise<{ slug: string }>;
}

// Pre-generate paths for all published content at build time
export async function generateStaticParams() {
  const data = await fetchLearnContent(undefined, undefined, 1, 200);
  return data.items.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const item = await fetchLearnContentBySlug(slug);
  if (!item) return {};

  return {
    title: { absolute: `${item.ogTitle || item.title} — Or This? Learn` },
    description: item.metaDescription || item.excerpt || undefined,
    alternates: { canonical: `/learn/${item.slug}` },
    keywords: item.seoKeywords,
    openGraph: {
      title: item.ogTitle || item.title,
      description: item.metaDescription || item.excerpt || undefined,
      type: "article",
      publishedTime: item.publishedAt || undefined,
      url: `https://orthis.app/learn/${item.slug}`,
    },
  };
}

// Gate threshold by content type
function getGateThreshold(contentType: string): number {
  switch (contentType) {
    case "trend_report": return 0.2; // gate after intro paragraph
    case "style_guide": return 0.25; // gate after first section
    case "style_tip": return 1; // tips not gated — each is a conversion hook
    case "tiktok_script": return 1; // scripts go to founder, not public
    default: return 0.4; // articles at ~40%
  }
}

// Schema.org type by content type
function getSchemaType(contentType: string): string {
  return contentType === "style_guide" ? "HowTo" : "Article";
}

const typeLabels: Record<string, string> = {
  trend_report: "Trend Report",
  style_tip: "Style Tip",
  style_guide: "Style Guide",
  article: "Article",
};

export default async function LearnContentPage({ params }: Props) {
  const { slug } = await params;
  const [item, relatedItems] = await Promise.all([
    fetchLearnContentBySlug(slug),
    fetchRelatedContent(slug),
  ]);

  if (!item) notFound();

  const gateThreshold = getGateThreshold(item.contentType);
  const schemaType = getSchemaType(item.contentType);
  const typeLabel = typeLabels[item.contentType] || "Article";

  // FAQ items from sourceData (populated by niche content generator)
  interface FaqItem { question: string; answer: string }
  const faqItems: FaqItem[] = (() => {
    try {
      const sd = item.sourceData as Record<string, unknown> | null | undefined;
      if (!sd) return [];
      const items = sd.faqItems;
      if (Array.isArray(items) && items.length > 0) return items as FaqItem[];
      return [];
    } catch { return []; }
  })();

  const dateStr = item.publishedAt
    ? new Date(item.publishedAt).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const fullUrl = `https://orthis.app/learn/${item.slug}`;

  return (
    <div style={{ backgroundColor: "#FBF7F4", minHeight: "100vh" }}>
      {/* Structured data */}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": schemaType,
          headline: item.title,
          description: item.metaDescription || item.excerpt,
          datePublished: item.publishedAt,
          dateModified: item.publishedAt,
          author: {
            "@type": "Organization",
            name: "Or This?",
            url: "https://orthis.app",
          },
          publisher: { "@id": "https://orthis.app/#organization" },
          mainEntityOfPage: fullUrl,
          keywords: item.seoKeywords?.join(", "),
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "https://orthis.app" },
            { "@type": "ListItem", position: 2, name: "Learn", item: "https://orthis.app/learn" },
            { "@type": "ListItem", position: 3, name: item.title },
          ],
        }}
      />

      {/* FAQ rich snippet — only when article has FAQ data */}
      {faqItems.length > 0 && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqItems.map((faq) => ({
              "@type": "Question",
              name: faq.question,
              acceptedAnswer: {
                "@type": "Answer",
                text: faq.answer,
              },
            })),
          }}
        />
      )}

      <LearnNav />

      <article className="max-w-3xl mx-auto px-6 py-12">
        {/* Header */}
        <header className="mb-12">
          <div className="flex items-center gap-4 mb-6 flex-wrap">
            <span
              className="text-xs font-medium uppercase tracking-widest"
              style={{ color: "#E85D4C" }}
            >
              {typeLabel}
            </span>
            {item.category && (
              <>
                <span style={{ color: "rgba(26,26,26,0.2)" }}>·</span>
                <span className="text-xs uppercase tracking-widest" style={{ color: "#9B9B9B" }}>
                  {item.category.replace(/-/g, " ")}
                </span>
              </>
            )}
            {dateStr && (
              <>
                <span style={{ color: "rgba(26,26,26,0.2)" }}>·</span>
                <time
                  dateTime={item.publishedAt || ""}
                  className="text-xs uppercase tracking-widest"
                  style={{ color: "#9B9B9B" }}
                >
                  {dateStr}
                </time>
              </>
            )}
          </div>
          <h1
            className="font-display mb-6"
            style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", color: "#1A1A1A", lineHeight: 1.1 }}
          >
            {item.title}
          </h1>
          {item.excerpt && (
            <p className="text-lg leading-relaxed mb-6" style={{ color: "rgba(45,45,45,0.65)" }}>
              {item.excerpt}
            </p>
          )}
          <div style={{ width: "60px", height: "1px", backgroundColor: "#E85D4C" }} />
        </header>

        {/* Content with gate */}
        {gateThreshold < 1 ? (
          <ContentGate threshold={gateThreshold}>
            <MarkdownRenderer content={item.content} />
          </ContentGate>
        ) : (
          <MarkdownRenderer content={item.content} />
        )}

        {/* Keywords */}
        {item.seoKeywords && item.seoKeywords.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-10 pt-8" style={{ borderTop: "1px solid rgba(26,26,26,0.08)" }}>
            {item.seoKeywords.map((kw) => (
              <span
                key={kw}
                className="text-xs px-3 py-1"
                style={{ backgroundColor: "#F5EDE7", color: "rgba(26,26,26,0.5)" }}
              >
                {kw}
              </span>
            ))}
          </div>
        )}

        {/* Related Articles */}
        {relatedItems.length > 0 && (
          <section className="mt-14 pt-10" style={{ borderTop: "1px solid rgba(26,26,26,0.08)" }}>
            <p className="text-xs font-medium uppercase tracking-widest mb-6" style={{ color: "rgba(26,26,26,0.4)" }}>
              Related Reading
            </p>
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
              {relatedItems.map((rel) => (
                <ContentCard
                  key={rel.id}
                  title={rel.title}
                  slug={rel.slug}
                  excerpt={rel.excerpt}
                  contentType={rel.contentType}
                  category={rel.category}
                  publishedAt={rel.publishedAt}
                  size="sm"
                />
              ))}
            </div>
          </section>
        )}

        {/* Bottom CTA */}
        <div
          className="mt-12 py-10 px-8"
          style={{ backgroundColor: "#1A1A1A" }}
        >
          <p
            className="text-xs uppercase tracking-widest mb-4"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >
            Get personalised advice
          </p>
          <h3
            className="font-display mb-3"
            style={{ color: "#fff", fontSize: "1.75rem", lineHeight: 1.2 }}
          >
            Score your actual outfit.
          </h3>
          <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.5)" }}>
            Theory is useful. But Or This? tells you exactly how your specific outfit scores — snap a photo, get a score out of 10.
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

        {/* Back link */}
        <div className="mt-8">
          <Link
            href="/learn"
            className="text-sm"
            style={{ color: "rgba(26,26,26,0.5)" }}
          >
            ← Back to Style Hub
          </Link>
        </div>
      </article>

      <footer
        className="border-t py-10 mt-8"
        style={{ borderColor: "rgba(26,26,26,0.08)", backgroundColor: "#FBF7F4" }}
      >
        <div className="max-w-3xl mx-auto px-6 flex items-center justify-between">
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
