import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Finding Your Style After 40 — AI Outfit Feedback | Or This?",
  description:
    "Reinventing your style after a life transition? Get honest AI feedback on your outfits. This is your chapter — dress like it.",
  alternates: { canonical: "https://orthis.app/reinvention" },
  openGraph: {
    title: "Finding Your Style After 40 — AI Outfit Feedback | Or This?",
    description:
      "Reinventing your style after a life transition? Get honest AI feedback on your outfits.",
    url: "https://orthis.app/reinvention",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Finding Your Style After 40 — AI Outfit Feedback | Or This?",
    description:
      "Reinventing your style after a life transition? Get honest AI feedback on your outfits.",
  },
};

export default function ReinventionLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
