import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Postpartum Outfit Ideas — AI Outfit Feedback | Or This?",
  description:
    "Getting dressed after having a baby is hard. Get honest AI feedback on outfits that actually fit your postpartum body — no pressure, no judgment.",
  alternates: { canonical: "https://orthis.app/postpartum-style" },
  openGraph: {
    title: "Postpartum Outfit Ideas — AI Outfit Feedback | Or This?",
    description:
      "Getting dressed after having a baby is hard. Get honest AI feedback on outfits that actually fit your postpartum body.",
    url: "https://orthis.app/postpartum-style",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Postpartum Outfit Ideas — AI Outfit Feedback | Or This?",
    description:
      "Getting dressed after having a baby is hard. Get honest AI feedback on outfits that actually fit your postpartum body.",
  },
};

export default function PostpartumStyleLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
