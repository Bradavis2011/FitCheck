import Link from "next/link";

const APP_STORE_URL = "https://apps.apple.com/app/or-this/id6742406265";

const NICHE_PAGES = [
  { href: "/back-to-work", label: "Back to Work" },
  { href: "/back-to-office", label: "Back to Office" },
  { href: "/dating-again", label: "Dating Again" },
  { href: "/postpartum-style", label: "Postpartum Style" },
  { href: "/career-change", label: "Career Change" },
  { href: "/reinvention", label: "Style Reinvention" },
  { href: "/rush", label: "Sorority Rush" },
];

export default function SiteFooter() {
  return (
    <footer
      className="border-t mt-8"
      style={{ borderColor: "rgba(26,26,26,0.08)", backgroundColor: "#FBF7F4" }}
    >
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="grid gap-8" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          {/* Brand */}
          <div>
            <Link href="/" className="text-xl font-medium mb-4 inline-block">
              <span className="font-sans font-medium" style={{ color: "#1A1A1A" }}>Or </span>
              <span className="font-display italic" style={{ color: "#E85D4C" }}>This?</span>
            </Link>
            <p className="text-xs leading-relaxed" style={{ color: "rgba(26,26,26,0.45)" }}>
              AI outfit feedback.<br />Confidence in every choice.
            </p>
          </div>

          {/* Style Guides */}
          <div>
            <p className="text-xs font-medium uppercase tracking-widest mb-4" style={{ color: "rgba(26,26,26,0.35)" }}>
              Style Guides
            </p>
            <ul className="flex flex-col gap-2">
              {NICHE_PAGES.map((page) => (
                <li key={page.href}>
                  <Link
                    href={page.href}
                    className="text-xs"
                    style={{ color: "rgba(26,26,26,0.55)" }}
                  >
                    {page.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Learn */}
          <div>
            <p className="text-xs font-medium uppercase tracking-widest mb-4" style={{ color: "rgba(26,26,26,0.35)" }}>
              Learn
            </p>
            <ul className="flex flex-col gap-2">
              <li><Link href="/learn" className="text-xs" style={{ color: "rgba(26,26,26,0.55)" }}>Style Hub</Link></li>
              <li><Link href="/learn/guides" className="text-xs" style={{ color: "rgba(26,26,26,0.55)" }}>Style Guides</Link></li>
              <li><Link href="/learn/tips" className="text-xs" style={{ color: "rgba(26,26,26,0.55)" }}>Style Tips</Link></li>
              <li><Link href="/learn/trends" className="text-xs" style={{ color: "rgba(26,26,26,0.55)" }}>Trend Reports</Link></li>
            </ul>
          </div>

          {/* App */}
          <div>
            <p className="text-xs font-medium uppercase tracking-widest mb-4" style={{ color: "rgba(26,26,26,0.35)" }}>
              App
            </p>
            <ul className="flex flex-col gap-2">
              <li><Link href="/try" className="text-xs" style={{ color: "rgba(26,26,26,0.55)" }}>Try It Free</Link></li>
              <li>
                <a
                  href={APP_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs"
                  style={{ color: "rgba(26,26,26,0.55)" }}
                >
                  Download — App Store
                </a>
              </li>
              <li><Link href="/privacy" className="text-xs" style={{ color: "rgba(26,26,26,0.55)" }}>Privacy</Link></li>
              <li><Link href="/terms" className="text-xs" style={{ color: "rgba(26,26,26,0.55)" }}>Terms</Link></li>
              <li><Link href="/support" className="text-xs" style={{ color: "rgba(26,26,26,0.55)" }}>Support</Link></li>
            </ul>
          </div>
        </div>

        <div
          className="mt-10 pt-6 flex items-center justify-between flex-wrap gap-4"
          style={{ borderTop: "1px solid rgba(26,26,26,0.06)" }}
        >
          <p className="text-xs" style={{ color: "rgba(26,26,26,0.3)" }}>
            &copy; {new Date().getFullYear()} Or This?
          </p>
          <div className="flex gap-4">
            <a
              href="https://x.com/OrThisApp"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs"
              style={{ color: "rgba(26,26,26,0.3)" }}
            >
              X / Twitter
            </a>
            <a
              href="https://www.tiktok.com/@or_this"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs"
              style={{ color: "rgba(26,26,26,0.3)" }}
            >
              TikTok
            </a>
            <a
              href="https://www.pinterest.com/OrThisApp/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs"
              style={{ color: "rgba(26,26,26,0.3)" }}
            >
              Pinterest
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
