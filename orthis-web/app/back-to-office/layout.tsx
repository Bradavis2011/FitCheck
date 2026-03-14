import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Return to Office Outfit Ideas 2026 — AI Outfit Feedback | Or This?",
  description:
    "Heading back to the office after years remote? Get AI feedback on your return-to-office outfits. Know you look the part before you walk in.",
  alternates: { canonical: "https://orthis.app/back-to-office" },
  openGraph: {
    title: "Return to Office Outfit Ideas 2026 — AI Outfit Feedback | Or This?",
    description:
      "Heading back to the office after years remote? Get AI feedback on your return-to-office outfits.",
    url: "https://orthis.app/back-to-office",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Return to Office Outfit Ideas 2026 — AI Outfit Feedback | Or This?",
    description:
      "Heading back to the office after years remote? Get AI feedback on your return-to-office outfits.",
  },
};

export default function BackToOfficeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
