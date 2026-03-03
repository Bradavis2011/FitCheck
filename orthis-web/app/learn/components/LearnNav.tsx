import Link from "next/link";

function Logo() {
  return (
    <Link href="/" className="text-xl font-medium">
      <span style={{ color: "#1A1A1A" }}>Or </span>
      <span className="font-display italic" style={{ color: "#E85D4C" }}>This?</span>
    </Link>
  );
}

interface LearnNavProps {
  activeTab?: "hub" | "trends" | "guides" | "tips";
}

export default function LearnNav({ activeTab }: LearnNavProps) {
  const tabs = [
    { id: "hub", label: "Style Hub", href: "/learn" },
    { id: "trends", label: "Trends", href: "/learn/trends" },
    { id: "guides", label: "Guides", href: "/learn/guides" },
    { id: "tips", label: "Tips", href: "/learn/tips" },
  ] as const;

  return (
    <nav
      style={{
        backgroundColor: "#FBF7F4",
        borderBottom: "1px solid rgba(26,26,26,0.08)",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between gap-6">
        <Logo />

        {/* Tab links */}
        <div className="flex items-center gap-1">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              className="text-xs font-medium uppercase tracking-wider px-4 py-2 transition-colors"
              style={{
                color: activeTab === tab.id ? "#E85D4C" : "rgba(26,26,26,0.45)",
                backgroundColor: activeTab === tab.id ? "rgba(232,93,76,0.06)" : "transparent",
              }}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {/* CTA */}
        <a
          href="https://orthis.app#waitlist"
          className="hidden md:block text-xs font-medium uppercase tracking-wider px-5 py-2"
          style={{ backgroundColor: "#E85D4C", color: "#fff" }}
        >
          Get Early Access
        </a>
      </div>
    </nav>
  );
}
