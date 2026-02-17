import type { Metadata } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";
import "./globals.css";

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
  description: "Get instant AI-powered feedback on your outfits. Confidence in every choice.",
  openGraph: {
    title: "Or This? — AI Outfit Feedback",
    description: "Get instant AI-powered feedback on your outfits. Confidence in every choice.",
    url: "https://orthis.app",
    siteName: "Or This?",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} ${playfair.variable} font-sans antialiased bg-cream text-clarity`}>
        {children}
      </body>
    </html>
  );
}
