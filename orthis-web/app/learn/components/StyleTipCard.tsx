import Link from "next/link";

interface StyleTipCardProps {
  title: string;
  slug: string;
  excerpt?: string | null;
  category?: string | null;
}

export default function StyleTipCard({ title, slug, excerpt, category }: StyleTipCardProps) {
  // Extract stat if present in excerpt (e.g. "65% confidence across 120 outfit checks")
  const statMatch = excerpt?.match(/(\d+%[^.]+)/);
  const stat = statMatch?.[1];

  return (
    <Link
      href={`/learn/${slug}`}
      style={{
        display: "block",
        backgroundColor: "#fff",
        padding: "20px",
        border: "1px solid rgba(26,26,26,0.06)",
        textDecoration: "none",
      }}
    >
      {/* Category badge */}
      {category && (
        <p
          className="text-xs font-medium uppercase tracking-wider mb-3"
          style={{ color: "#10B981" }}
        >
          {category.replace(/-/g, " ")}
        </p>
      )}

      {/* Title */}
      <p className="text-sm font-medium leading-snug mb-3" style={{ color: "#1A1A1A" }}>
        {title}
      </p>

      {/* Stat callout */}
      {stat && (
        <div
          className="px-3 py-2 mb-3"
          style={{ backgroundColor: "#F5EDE7", borderLeft: "2px solid #10B981" }}
        >
          <p className="text-xs font-medium" style={{ color: "#10B981" }}>
            📊 {stat}
          </p>
        </div>
      )}

      <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "#E85D4C" }}>
        See tip →
      </p>
    </Link>
  );
}
