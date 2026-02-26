import type { Metadata } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";
import "./globals.css";
import PostHogInit from "./posthog-init";

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
  title: "Or This? — AI Outfit Feedback",
  description: "Stop texting friends 'does this look ok?' Get instant AI feedback on your outfit before you walk out the door.",
  metadataBase: new URL("https://orthis.app"),
  alternates: {
    canonical: "https://orthis.app",
  },
  openGraph: {
    title: "Or This? — AI Outfit Feedback",
    description: "Stop texting friends 'does this look ok?' Get instant AI feedback on your outfit before you walk out the door.",
    url: "https://orthis.app",
    siteName: "Or This?",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Or This? — AI Outfit Feedback",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Or This? — AI Outfit Feedback",
    description: "Stop texting friends 'does this look ok?' Get instant AI feedback on your outfit before you walk out the door.",
    site: "@orthisapp",
    creator: "@orthisapp",
    images: ["/og-image.jpg"],
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
        <PostHogInit />
        {children}
      </body>
    </html>
  );
}
