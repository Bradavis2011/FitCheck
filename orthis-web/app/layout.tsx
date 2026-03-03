import type { Metadata } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";
import "./globals.css";
import PostHogInit from "./posthog-init";
import { JsonLd } from "./components/JsonLd";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: {
    default: "Or This? — AI Outfit Feedback & Style Advice App",
    template: "%s — Or This?",
  },
  description:
    "Or This? is the AI outfit feedback app that tells you the truth. Snap a photo, get a score out of 10, and know what to wear — before you walk out the door.",
  metadataBase: new URL("https://orthis.app"),
  alternates: {
    canonical: "https://orthis.app",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Or This? — AI Outfit Feedback & Style Advice App",
    description:
      "Or This? is the AI outfit feedback app that tells you the truth. Snap a photo, get a score out of 10, and know what to wear — before you walk out the door.",
    url: "https://orthis.app",
    siteName: "Or This?",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Or This? — AI Outfit Feedback & Style Advice App",
    description:
      "Or This? is the AI outfit feedback app that tells you the truth. Snap a photo, get a score out of 10, and know what to wear — before you walk out the door.",
    site: "@OrThisApp",
    creator: "@OrThisApp",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} ${playfair.variable} font-sans antialiased bg-white text-clarity`}>
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Organization",
                "@id": "https://orthis.app/#organization",
                name: "Or This?",
                url: "https://orthis.app",
                logo: "https://orthis.app/icon.svg",
                sameAs: [
                  "https://x.com/OrThisApp",
                  "https://www.tiktok.com/@or_this",
                  "https://www.pinterest.com/OrThisApp/",
                ],
                description:
                  "Or This? is an AI-powered outfit feedback app. Snap a photo, get an honest score and style advice before you walk out the door.",
              },
              {
                "@type": "WebSite",
                "@id": "https://orthis.app/#website",
                url: "https://orthis.app",
                name: "Or This?",
                publisher: { "@id": "https://orthis.app/#organization" },
              },
            ],
          }}
        />
        <PostHogInit />
        {children}
      </body>
    </html>
  );
}
