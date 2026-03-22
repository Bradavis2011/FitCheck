import Link from "next/link";

const APP_STORE_URL = "https://apps.apple.com/app/or-this/id6742406265";

export default function ServerNav() {
  return (
    <nav
      className="border-b"
      style={{ backgroundColor: "#FBF7F4", borderColor: "rgba(26,26,26,0.08)", padding: "16px 24px" }}
    >
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <Link href="/" className="text-xl font-medium">
          <span className="font-sans font-medium" style={{ color: "#1A1A1A" }}>Or </span>
          <span className="font-display italic" style={{ color: "#E85D4C" }}>This?</span>
        </Link>
        <div className="flex items-center gap-6">
          <Link href="/try" className="text-xs font-medium uppercase tracking-wider" style={{ color: "rgba(26,26,26,0.55)" }}>
            Try
          </Link>
          <Link href="/learn" className="text-xs font-medium uppercase tracking-wider" style={{ color: "rgba(26,26,26,0.55)" }}>
            Learn
          </Link>
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium uppercase tracking-wider px-5 py-2.5"
            style={{ backgroundColor: "#E85D4C", color: "#fff" }}
          >
            Download
          </a>
        </div>
      </div>
    </nav>
  );
}
