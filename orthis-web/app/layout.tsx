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
  icons: {
    icon: [{ url: "/icon", type: "image/png", sizes: "32x32" }],
    apple: [{ url: "/apple-icon", type: "image/png", sizes: "180x180" }],
  },
  openGraph: {
    title: "Or This? — AI Outfit Feedback",
    description: "Stop texting friends 'does this look ok?' Get instant AI feedback on your outfit before you walk out the door.",
    url: "https://orthis.app",
    siteName: "Or This?",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Or This? — AI Outfit Feedback",
    description: "Stop texting friends 'does this look ok?' Get instant AI feedback on your outfit before you walk out the door.",
    site: "@orthisapp",
    creator: "@orthisapp",
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
