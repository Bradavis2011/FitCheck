import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Back to Work Outfits After Kids — AI Outfit Feedback | Or This?",
  description:
    "Returning to the workplace after time at home? Get instant AI feedback on your back-to-work outfits. Know you look the part before day one.",
  alternates: { canonical: "https://orthis.app/back-to-work" },
  openGraph: {
    title: "Back to Work Outfits After Kids — AI Outfit Feedback | Or This?",
    description:
      "Returning to the workplace after time at home? Get instant AI feedback on your back-to-work outfits.",
    url: "https://orthis.app/back-to-work",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Back to Work Outfits After Kids — AI Outfit Feedback | Or This?",
    description:
      "Returning to the workplace after time at home? Get instant AI feedback on your back-to-work outfits.",
  },
};

export default function BackToWorkLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
