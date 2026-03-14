import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "First Date Outfits After Divorce — AI Outfit Feedback | Or This?",
  description:
    "Dating again after divorce or a breakup? Get honest AI feedback on your first date outfit. Confidence first — no judgment, no noise.",
  alternates: { canonical: "https://orthis.app/dating-again" },
  openGraph: {
    title: "First Date Outfits After Divorce — AI Outfit Feedback | Or This?",
    description:
      "Dating again after divorce or a breakup? Get honest AI feedback on your first date outfit.",
    url: "https://orthis.app/dating-again",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "First Date Outfits After Divorce — AI Outfit Feedback | Or This?",
    description:
      "Dating again after divorce or a breakup? Get honest AI feedback on your first date outfit.",
  },
};

export default function DatingAgainLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
