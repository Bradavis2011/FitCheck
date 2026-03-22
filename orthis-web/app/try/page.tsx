import type { Metadata } from "next";
import Link from "next/link";
import OutfitScorer from "./components/OutfitScorer";
import SiteFooter from "../components/SiteFooter";

const APP_STORE_URL = "https://apps.apple.com/app/or-this/id6742406265";

export const metadata: Metadata = {
  title: { absolute: "Score Your Outfit — Or This? AI Outfit Feedback" },
  description:
    "Upload a photo of your outfit and get an AI score out of 10 in seconds. Free — no account required. Work, dates, casual, interviews — honest feedback for any occasion.",
  alternates: { canonical: "/try" },
  openGraph: {
    title: "Score Your Outfit — Or This? AI Outfit Feedback",
    description:
      "Upload a photo, pick your occasion, get an AI score out of 10. Free. No account needed.",
    url: "https://orthis.app/try",
  },
};

const HOW_IT_WORKS = [
  {
    step: "01",
    label: "Upload your photo",
    desc: "Take a photo in the mirror or upload from your camera roll. JPEG, PNG, or WEBP — up to 5MB.",
  },
  {
    step: "02",
    label: "Pick your occasion",
    desc: "Work, date night, casual, interview, event, or weekend. Context shapes the feedback.",
  },
  {
    step: "03",
    label: "Get your score",
    desc: "AI scores your outfit out of 10 — what's working, what to tweak, and what's landing flat.",
  },
];

export default function TryPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#FBF7F4",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* Nav */}
      <nav
        style={{
          borderBottom: "1px solid rgba(26,26,26,0.1)",
          padding: "20px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          maxWidth: "1100px",
          margin: "0 auto",
        }}
      >
        <Link href="/" style={{ textDecoration: "none" }}>
          <span style={{ fontSize: "18px" }}>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500, color: "#1A1A1A" }}>Or </span>
            <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontStyle: "italic", color: "#E85D4C" }}>This?</span>
          </span>
        </Link>
        <a
          href={APP_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "13px",
            fontWeight: 600,
            color: "#fff",
            background: "#1A1A1A",
            padding: "8px 16px",
            textDecoration: "none",
            borderRadius: 0,
          }}
        >
          Download App
        </a>
      </nav>

      <main style={{ maxWidth: "640px", margin: "0 auto", padding: "48px 24px 80px" }}>
        {/* Hero */}
        <div style={{ marginBottom: "40px", textAlign: "center" }}>
          <h1
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontStyle: "italic",
              fontSize: "clamp(32px, 6vw, 48px)",
              color: "#1A1A1A",
              margin: "0 0 12px",
              lineHeight: 1.15,
            }}
          >
            Score your outfit in 10 seconds.
          </h1>
          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "16px",
              color: "rgba(26,26,26,0.6)",
              margin: 0,
            }}
          >
            Upload a photo. Pick your occasion. Get your score.
          </p>
        </div>

        {/* How it works */}
        <div style={{ marginBottom: "40px" }}>
          <div
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "1.5px",
              color: "rgba(26,26,26,0.4)",
              marginBottom: "16px",
            }}
          >
            How it works
          </div>
          <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
            {HOW_IT_WORKS.map((item) => (
              <div
                key={item.step}
                style={{
                  padding: "16px",
                  background: "#fff",
                  border: "1px solid rgba(26,26,26,0.06)",
                }}
              >
                <div
                  style={{
                    fontFamily: "'Playfair Display', Georgia, serif",
                    fontStyle: "italic",
                    fontSize: "11px",
                    color: "#E85D4C",
                    marginBottom: "6px",
                  }}
                >
                  {item.step}
                </div>
                <div
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "12px",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.8px",
                    color: "#1A1A1A",
                    marginBottom: "4px",
                  }}
                >
                  {item.label}
                </div>
                <p
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "12px",
                    color: "rgba(26,26,26,0.55)",
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Interactive scorer — client component */}
        <OutfitScorer />

        {/* Footer links */}
        <div
          style={{
            marginTop: "48px",
            paddingTop: "24px",
            borderTop: "1px solid rgba(26,26,26,0.08)",
            display: "flex",
            flexWrap: "wrap",
            gap: "16px",
            justifyContent: "center",
          }}
        >
          <Link href="/learn" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "12px", color: "rgba(26,26,26,0.45)" }}>
            Style Hub
          </Link>
          <Link href="/back-to-work" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "12px", color: "rgba(26,26,26,0.45)" }}>
            Back to Work Guide
          </Link>
          <Link href="/dating-again" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "12px", color: "rgba(26,26,26,0.45)" }}>
            Dating Again Guide
          </Link>
          <Link href="/rush" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "12px", color: "rgba(26,26,26,0.45)" }}>
            Sorority Rush Guide
          </Link>
          <Link href="/" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "12px", color: "rgba(26,26,26,0.45)" }}>
            Home
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
