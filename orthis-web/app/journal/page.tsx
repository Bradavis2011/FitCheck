import Link from "next/link";
import type { Metadata } from "next";
import { getPostMeta } from "../../content/journal/index.js";

export const metadata: Metadata = {
  title: "Journal — Or This?",
  description: "Thoughts on fashion, AI, building in public, and the future of personal style.",
  alternates: { canonical: "/journal" },
};

function Logo() {
  return (
    <Link href="/" className="text-xl">
      <span className="font-sans font-medium" style={{ color: "#1A1A1A" }}>Or </span>
      <span className="font-display italic" style={{ color: "#E85D4C" }}>This?</span>
    </Link>
  );
}

export default function JournalPage() {
  const posts = getPostMeta();

  return (
    <div style={{ backgroundColor: "#FBF7F4", minHeight: "100vh" }}>
      <nav className="flex items-center justify-between px-6 py-5 max-w-3xl mx-auto">
        <Logo />
        <Link
          href="/#waitlist"
          className="text-sm font-medium transition-colors"
          style={{ color: "#E85D4C" }}
        >
          Join waitlist
        </Link>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <header className="mb-16">
          <p
            className="text-xs uppercase tracking-widest mb-4"
            style={{ color: "#9B9B9B" }}
          >
            The Journal
          </p>
          <h1
            className="font-display mb-4"
            style={{ fontSize: "clamp(2.5rem, 5vw, 4rem)", color: "#1A1A1A", lineHeight: 1.1 }}
          >
            Thoughts on style,<br />AI, and building.
          </h1>
          <div style={{ width: "60px", height: "1px", backgroundColor: "#E85D4C" }} />
        </header>

        <div className="flex flex-col gap-0">
          {posts.map((post, i) => (
            <article key={post.slug}>
              {i > 0 && (
                <div
                  style={{ height: "1px", backgroundColor: "rgba(26,26,26,0.1)", margin: "40px 0" }}
                />
              )}
              <Link href={`/journal/${post.slug}`} className="group block">
                <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 mb-3">
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
                  <span className="text-xs" style={{ color: "#9B9B9B" }}>
                    {post.readingTime}
                  </span>
                </div>
                <h2
                  className="text-2xl sm:text-3xl font-medium mb-3 transition-colors group-hover:text-coral"
                  style={{ color: "#1A1A1A", lineHeight: 1.25 }}
                >
                  {post.title}
                </h2>
                <p
                  className="text-base leading-relaxed mb-4"
                  style={{ color: "rgba(45,45,45,0.6)" }}
                >
                  {post.description}
                </p>
                <span
                  className="text-sm font-medium transition-colors group-hover:text-coral"
                  style={{ color: "#E85D4C" }}
                >
                  Read →
                </span>
              </Link>
            </article>
          ))}
        </div>
      </main>

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
