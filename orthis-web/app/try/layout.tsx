import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Score Your Outfit — Or This?",
  description:
    "Upload a photo and get your outfit scored in 10 seconds. AI feedback on what's working — free, no app required.",
  openGraph: {
    title: "Score Your Outfit in 10 Seconds",
    description:
      "Free AI outfit scoring. Upload a photo, pick your occasion, get your score.",
    url: "https://orthis.app/try",
    siteName: "Or This?",
    images: [
      {
        url: "https://orthis.app/og-image.png",
        width: 1200,
        height: 630,
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Score Your Outfit in 10 Seconds",
    description: "Free AI outfit scoring — no app required.",
    images: ["https://orthis.app/og-image.png"],
  },
  alternates: {
    canonical: "https://orthis.app/try",
  },
};

export default function TryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
