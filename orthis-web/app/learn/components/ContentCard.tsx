import Link from "next/link";

interface ContentCardProps {
  title: string;
  slug: string;
  excerpt?: string | null;
  contentType: string;
  category?: string | null;
  publishedAt?: string | Date | null;
  seoKeywords?: string[];
  size?: "sm" | "md" | "lg";
}

const typeLabels: Record<string, string> = {
  trend_report: "Trend Report",
  style_tip: "Style Tip",
  style_guide: "Style Guide",
  article: "Article",
  tiktok_script: "TikTok Script",
};

const typeColors: Record<string, string> = {
  trend_report: "#E85D4C",
  style_tip: "#10B981",
  style_guide: "#6366F1",
  article: "#F59E0B",
  tiktok_script: "#EC4899",
};

export default function ContentCard({
  title,
  slug,
  excerpt,
  contentType,
  category,
  publishedAt,
  seoKeywords = [],
  size = "md",
}: ContentCardProps) {
  const typeLabel = typeLabels[contentType] || contentType;
  const typeColor = typeColors[contentType] || "#9B9B9B";
  const dateStr = publishedAt
    ? new Date(publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <Link
      href={`/learn/${slug}`}
      style={{
        display: "block",
        backgroundColor: "#fff",
        padding: size === "lg" ? "28px" : size === "sm" ? "16px" : "20px",
        textDecoration: "none",
        border: "1px solid rgba(26,26,26,0.06)",
        transition: "border-color 0.2s",
      }}
      className="hover:border-coral"
    >
      {/* Type badge */}
      <div className="flex items-center gap-3 mb-3">
        <span
          className="text-xs font-medium uppercase tracking-wider"
          style={{ color: typeColor }}
        >
          {typeLabel}
        </span>
        {category && (
          <>
            <span style={{ color: "rgba(26,26,26,0.2)" }}>·</span>
            <span className="text-xs uppercase tracking-wider" style={{ color: "rgba(26,26,26,0.4)" }}>
              {category.replace(/-/g, " ")}
            </span>
          </>
        )}
        {dateStr && (
          <>
            <span style={{ color: "rgba(26,26,26,0.2)" }}>·</span>
            <time className="text-xs" style={{ color: "rgba(26,26,26,0.4)" }}>{dateStr}</time>
          </>
        )}
      </div>

      {/* Title */}
      <h2
        className={size === "lg" ? "font-display mb-3" : "font-medium mb-2"}
        style={{
          fontSize: size === "lg" ? "clamp(1.25rem, 2.5vw, 1.75rem)" : size === "sm" ? "0.9rem" : "1rem",
          color: "#1A1A1A",
          lineHeight: 1.3,
        }}
      >
        {title}
      </h2>

      {/* Excerpt */}
      {excerpt && (
        <p
          className="text-sm leading-relaxed mb-4"
          style={{ color: "rgba(45,45,45,0.65)", lineHeight: 1.6 }}
        >
          {excerpt.length > 140 ? excerpt.slice(0, 137) + "..." : excerpt}
        </p>
      )}

      {/* Keywords as chips */}
      {seoKeywords.length > 0 && size !== "sm" && (
        <div className="flex flex-wrap gap-2 mt-auto pt-2">
          {seoKeywords.slice(0, 3).map((kw) => (
            <span
              key={kw}
              className="text-xs px-2 py-1"
              style={{ backgroundColor: "#F5EDE7", color: "rgba(26,26,26,0.5)" }}
            >
              {kw}
            </span>
          ))}
        </div>
      )}

      {/* Read link */}
      <p
        className="text-xs font-medium uppercase tracking-wider mt-3"
        style={{ color: "#E85D4C" }}
      >
        Read →
      </p>
    </Link>
  );
}
