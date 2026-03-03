import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getPostBySlug, getPostMeta } from "../../../content/journal/index.js";
import type { PostSection } from "../../../content/journal/what-wispr-flow-taught-us-about-ugc.js";
import WaitlistInline from "./waitlist-inline.js";
import { JsonLd } from "../../components/JsonLd";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getPostMeta().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  return {
    title: { absolute: `${post.title} — Or This? Journal` },
    description: post.description,
    alternates: { canonical: `/journal/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.date,
    },
  };
}

function Logo() {
  return (
    <Link href="/" className="text-xl">
      <span className="font-sans font-medium" style={{ color: "#1A1A1A" }}>Or </span>
      <span className="font-display italic" style={{ color: "#E85D4C" }}>This?</span>
    </Link>
  );
}

function renderSection(section: PostSection, index: number) {
  switch (section.type) {
    case "heading":
      return (
        <h2
          key={index}
          className="font-display mt-14 mb-5"
          style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", color: "#1A1A1A", lineHeight: 1.2 }}
        >
          {section.text}
        </h2>
      );
    case "paragraph":
      return (
        <p
          key={index}
          className="text-lg leading-relaxed mb-6"
          style={{ color: "#2D2D2D" }}
        >
          {section.text}
        </p>
      );
    case "list":
      return (
        <ul key={index} className="mb-6 flex flex-col gap-3">
          {section.items.map((item, i) => (
            <li key={i} className="flex items-start gap-4">
              <span style={{ color: "#E85D4C", flexShrink: 0, marginTop: "0.25rem" }}>—</span>
              <span className="text-lg leading-relaxed" style={{ color: "#2D2D2D" }}>
                {item}
              </span>
            </li>
          ))}
        </ul>
      );
    case "callout":
      return (
        <blockquote
          key={index}
          className="my-10 py-8 px-8"
          style={{
            borderLeft: "3px solid #E85D4C",
            backgroundColor: "#F5EDE7",
          }}
        >
          <p
            className="font-display text-2xl leading-relaxed m-0"
            style={{ color: "#1A1A1A" }}
          >
            {section.text}
          </p>
        </blockquote>
      );
    default:
      return null;
  }
}

export default async function JournalPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  // Find the mid-article insertion point (after ~50% of sections)
  const midPoint = Math.floor(post.sections.length * 0.55);

  return (
    <div style={{ backgroundColor: "#FBF7F4", minHeight: "100vh" }}>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: post.title,
          datePublished: post.date,
          dateModified: post.date,
          author: {
            "@type": "Organization",
            name: "Or This?",
            url: "https://orthis.app",
          },
          publisher: { "@id": "https://orthis.app/#organization" },
          description: post.description,
          mainEntityOfPage: `https://orthis.app/journal/${post.slug}`,
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Home",
              item: "https://orthis.app",
            },
            {
              "@type": "ListItem",
              position: 2,
              name: "Journal",
              item: "https://orthis.app/journal",
            },
            {
              "@type": "ListItem",
              position: 3,
              name: post.title,
            },
          ],
        }}
      />
      <nav className="flex items-center justify-between px-6 py-5 max-w-3xl mx-auto">
        <Logo />
        <Link
          href="/journal"
          className="text-sm transition-colors"
          style={{ color: "rgba(26,26,26,0.5)" }}
        >
          ← Journal
        </Link>
      </nav>

      <article className="max-w-3xl mx-auto px-6 py-12">
        {/* Header */}
        <header className="mb-12">
          <div className="flex items-center gap-4 mb-6">
            <time
              dateTime={post.date}
              className="text-xs uppercase tracking-widest"
              style={{ color: "#9B9B9B" }}
            >
              {new Date(post.date).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </time>
            <span style={{ color: "rgba(26,26,26,0.2)" }}>·</span>
            <span className="text-xs uppercase tracking-widest" style={{ color: "#9B9B9B" }}>
              {post.readingTime}
            </span>
          </div>
          <h1
            className="font-display mb-6"
            style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", color: "#1A1A1A", lineHeight: 1.1 }}
          >
            {post.title}
          </h1>
          <div style={{ width: "60px", height: "1px", backgroundColor: "#E85D4C" }} />
        </header>

        {/* First half of post */}
        <div className="prose-editorial">
          {post.sections.slice(0, midPoint).map((section, i) => renderSection(section, i))}
        </div>

        {/* Mid-article waitlist CTA */}
        <div className="my-12 py-10 px-8" style={{ backgroundColor: "#1A1A1A" }}>
          <p
            className="text-xs uppercase tracking-widest mb-4"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >
            Early Access
          </p>
          <h3
            className="font-display mb-3"
            style={{ color: "#fff", fontSize: "1.75rem", lineHeight: 1.2 }}
          >
            Try it before the public does.
          </h3>
          <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.5)" }}>
            Or This? is in TestFlight now. Join the waitlist for early access.
          </p>
          <WaitlistInline />
        </div>

        {/* Second half of post */}
        <div className="prose-editorial">
          {post.sections.slice(midPoint).map((section, i) => renderSection(section, midPoint + i))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 pt-12" style={{ borderTop: "1px solid rgba(26,26,26,0.1)" }}>
          <p className="text-xs uppercase tracking-widest mb-4" style={{ color: "#9B9B9B" }}>
            Join the waitlist
          </p>
          <h3
            className="font-display mb-4"
            style={{ color: "#1A1A1A", fontSize: "2rem", lineHeight: 1.2 }}
          >
            Be first when we launch.
          </h3>
          <p className="text-base mb-6" style={{ color: "rgba(45,45,45,0.6)" }}>
            TestFlight access now. Your first month of Plus is included at launch.
          </p>
          <WaitlistInline />
        </div>
      </article>

      <footer
        className="border-t py-10 mt-20"
        style={{ borderColor: "rgba(26,26,26,0.1)", backgroundColor: "#FBF7F4" }}
      >
        <div className="max-w-3xl mx-auto px-6 flex items-center justify-between">
          <Logo />
          <p className="text-xs" style={{ color: "rgba(26,26,26,0.3)" }}>
            &copy; {new Date().getFullYear()} Or This?
          </p>
        </div>
      </footer>
    </div>
  );
}
