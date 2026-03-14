import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "What to Wear for a Career Change — AI Outfit Feedback | Or This?",
  description:
    "Starting a new career or pivoting industries? Get honest AI feedback on your interview and first-day outfits. Show up looking like you belong.",
  alternates: { canonical: "https://orthis.app/career-change" },
  openGraph: {
    title: "What to Wear for a Career Change — AI Outfit Feedback | Or This?",
    description:
      "Starting a new career or pivoting industries? Get honest AI feedback on your interview and first-day outfits.",
    url: "https://orthis.app/career-change",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "What to Wear for a Career Change — AI Outfit Feedback | Or This?",
    description:
      "Starting a new career or pivoting industries? Get honest AI feedback on your interview and first-day outfits.",
  },
};

export default function CareerChangeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
