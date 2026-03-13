import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sorority Rush Outfits — AI Outfit Feedback | Or This?",
  description:
    "Stop stressing about your rush outfits. Get instant AI feedback before you walk into a single party. Know exactly what works — and what doesn't — for every round.",
  alternates: {
    canonical: "https://orthis.app/rush",
  },
  openGraph: {
    title: "Sorority Rush Outfits — AI Outfit Feedback | Or This?",
    description:
      "Stop stressing about your rush outfits. Get instant AI feedback before you walk into a single party.",
    url: "https://orthis.app/rush",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sorority Rush Outfits — AI Outfit Feedback | Or This?",
    description:
      "Stop stressing about your rush outfits. Get instant AI feedback before you walk into a single party.",
  },
};

export default function RushLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
