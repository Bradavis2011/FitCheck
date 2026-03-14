import Link from "next/link";
import Image from "next/image";
import { JsonLd } from "./components/JsonLd";
import ClientNav from "./components/ClientNav";
import WaitlistForm from "./components/WaitlistForm";
import ScrollRevealWrapper from "./components/ScrollRevealWrapper";

// Local illustration assets
import illustrationDuo from "../assets/images/fabian-kunzel-zeller-Kd0oUzb2Bfg-unsplash.jpg";
import illustrationBlue from "../assets/images/fabian-kunzel-zeller-LLXs757C7DA-unsplash.jpg";
import illustrationTan from "../assets/images/fabian-kunzel-zeller-xZokPso8xys-unsplash.jpg";
import illustrationPurple from "../assets/images/fabian-kunzel-zeller-Ir7tmdZ6dWU-unsplash.jpg";
import charlotaPhoto from "../assets/images/charlota-blunarova-r5xHI_H44aM-unsplash.jpg";

function Logo() {
  return (
    <span className="text-xl select-none">
      <span className="font-sans font-medium text-clarity">Or </span>
      <span className="font-display italic text-coral">This?</span>
    </span>
  );
}

function DownloadSection() {
  const appStoreUrl = "https://apps.apple.com/ca/app/or-this/id6759472490";
  const testFlightUrl = process.env.NEXT_PUBLIC_TESTFLIGHT_URL;
  const playStoreUrl = process.env.NEXT_PUBLIC_PLAYSTORE_URL;

  return (
    <section className="py-24 sm:py-32 bg-white">
      <div className="max-w-2xl mx-auto px-6 text-center fade-in-up">
        <span
          className="editorial-rule mb-8 mx-auto"
          style={{ backgroundColor: "#E85D4C", display: "block", width: 40 }}
        />
        <p className="section-label mb-4" style={{ color: "rgba(26,26,26,0.4)" }}>
          Available now
        </p>
        <h2 className="pull-quote text-4xl sm:text-5xl text-clarity leading-tight mb-10">
          Get the app.
        </h2>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {appStoreUrl && (
            <a
              href={appStoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Download on the App Store"
              className="inline-flex items-center gap-3 px-6 py-3 bg-clarity text-white transition-opacity hover:opacity-80"
              style={{ borderRadius: 0 }}
            >
              <svg width="20" height="24" viewBox="0 0 814 1000" fill="currentColor" aria-hidden="true">
                <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-42.8-162.6-115.3c-47.8-59.2-88.3-150.9-88.3-238.9 0-181.5 115.6-308.8 251.4-308.8 64.6 0 117.8 40.8 158.6 40.8 39.5 0 101.1-43.2 176.7-43.2 28.2 0 130.3 2.6 195.8 85.8zm-234.3-166c28.2-26.9 46.8-64.6 46.8-102.3 0-5.2-.6-10.4-1.3-15.6-44.5 1.9-97 30.8-128.1 60.9-25.6 23.1-48.1 61.3-48.1 99.5 0 5.8.6 11.7 1.3 13.6 3.2.6 7.1.6 11 .6 40.8 0 90.3-27.5 118.4-56.7z" />
              </svg>
              <span className="flex flex-col text-left">
                <span className="text-xs opacity-70 leading-none mb-0.5">Download on the</span>
                <span className="text-base font-semibold leading-none">App Store</span>
              </span>
            </a>
          )}
          {testFlightUrl && !appStoreUrl && (
            <a
              href={testFlightUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-6 py-3 bg-clarity text-white transition-opacity hover:opacity-80"
              style={{ borderRadius: 0 }}
            >
              <svg width="20" height="24" viewBox="0 0 814 1000" fill="currentColor" aria-hidden="true">
                <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-42.8-162.6-115.3c-47.8-59.2-88.3-150.9-88.3-238.9 0-181.5 115.6-308.8 251.4-308.8 64.6 0 117.8 40.8 158.6 40.8 39.5 0 101.1-43.2 176.7-43.2 28.2 0 130.3 2.6 195.8 85.8zm-234.3-166c28.2-26.9 46.8-64.6 46.8-102.3 0-5.2-.6-10.4-1.3-15.6-44.5 1.9-97 30.8-128.1 60.9-25.6 23.1-48.1 61.3-48.1 99.5 0 5.8.6 11.7 1.3 13.6 3.2.6 7.1.6 11 .6 40.8 0 90.3-27.5 118.4-56.7z" />
              </svg>
              <span className="flex flex-col text-left">
                <span className="text-xs opacity-70 leading-none mb-0.5">Try the beta on</span>
                <span className="text-base font-semibold leading-none">TestFlight</span>
              </span>
            </a>
          )}
          {playStoreUrl && (
            <a
              href={playStoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Get it on Google Play"
              className="inline-flex items-center gap-3 px-6 py-3 transition-opacity hover:opacity-80"
              style={{ borderRadius: 0, background: "#1A1A1A", color: "white" }}
            >
              <svg width="20" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M3 20.5v-17c0-.83 1-.83 1.5-.5l14 8.5-14 8.5c-.5.33-1.5.33-1.5-.5z" />
              </svg>
              <span className="flex flex-col text-left">
                <span className="text-xs opacity-70 leading-none mb-0.5">Get it on</span>
                <span className="text-base font-semibold leading-none">Google Play</span>
              </span>
            </a>
          )}
        </div>
        {testFlightUrl && appStoreUrl && (
          <p className="mt-6 text-sm" style={{ color: "rgba(26,26,26,0.4)" }}>
            Also available on{" "}
            <a
              href={testFlightUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-coral transition-colors"
            >
              TestFlight
            </a>
            {" "}(iOS beta)
          </p>
        )}
        {!playStoreUrl && (
          <p className="mt-4 text-sm" style={{ color: "rgba(26,26,26,0.3)" }}>
            Android coming soon.
          </p>
        )}
      </div>
    </section>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const params = await searchParams;
  const refCode = params.ref || "";

  return (
    <ScrollRevealWrapper>
      <div className="min-h-screen bg-white">
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "Or This?",
            applicationCategory: "LifestyleApplication",
            operatingSystem: "iOS, Android",
            description:
              "AI outfit feedback app — snap a photo, get a score out of 10, and honest style advice before you leave.",
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "USD",
              description: "Free with optional Plus subscription",
            },
            creator: { "@id": "https://orthis.app/#organization" },
            url: "https://orthis.app",
            featureList: [
              "AI outfit scoring out of 10",
              "Personalized style advice",
              "Follow-up questions about your outfit",
              "Style DNA that learns over time",
              "AI-built wardrobe tracking",
            ],
          }}
        />

        {/* ── 1. Nav ── */}
        <ClientNav />

        {/* ── 2. Hero — Full-bleed video, 100vh ── */}
        <section className="relative w-full h-screen overflow-hidden">
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            poster="/video/hero-poster.jpg"
            className="absolute inset-0 w-full h-full object-cover"
          >
            <source src="/video/7305164-uhd_4096_2160_25fps.mp4" type="video/mp4" />
          </video>
          <div className="hero-overlay absolute inset-0" />
          <div className="relative h-full flex flex-col items-center justify-center text-center px-6 pt-20">
            <p className="section-label text-white/50 mb-8 fade-in-up">
              For everyone who&apos;s ever changed three times before leaving
            </p>
            <h1 className="pull-quote text-6xl sm:text-7xl lg:text-8xl text-white leading-tight mb-6 fade-in-up max-w-4xl">
              You already know<br />the question.
            </h1>
            <p className="text-4xl sm:text-5xl lg:text-6xl mb-14 fade-in-up">
              <span className="font-sans font-medium text-clarity">Or </span>
              <span className="font-display italic text-coral">This?</span>
            </p>
            <div className="w-full max-w-md fade-in-up">
              <WaitlistForm refCode={refCode} variant="dark" />
            </div>
            <div className="mt-8 fade-in-up">
              <a
                href="https://apps.apple.com/ca/app/or-this/id6759472490"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Download on the App Store"
                className="inline-flex items-center gap-3 px-5 py-3 bg-white transition-opacity hover:opacity-80"
                style={{ borderRadius: 0 }}
              >
                <svg width="18" height="22" viewBox="0 0 814 1000" fill="#1A1A1A" aria-hidden="true">
                  <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-42.8-162.6-115.3c-47.8-59.2-88.3-150.9-88.3-238.9 0-181.5 115.6-308.8 251.4-308.8 64.6 0 117.8 40.8 158.6 40.8 39.5 0 101.1-43.2 176.7-43.2 28.2 0 130.3 2.6 195.8 85.8zm-234.3-166c28.2-26.9 46.8-64.6 46.8-102.3 0-5.2-.6-10.4-1.3-15.6-44.5 1.9-97 30.8-128.1 60.9-25.6 23.1-48.1 61.3-48.1 99.5 0 5.8.6 11.7 1.3 13.6 3.2.6 7.1.6 11 .6 40.8 0 90.3-27.5 118.4-56.7z" />
                </svg>
                <span className="flex flex-col text-left">
                  <span className="text-xs leading-none mb-0.5" style={{ color: "rgba(26,26,26,0.5)" }}>Download on the</span>
                  <span className="text-sm font-semibold leading-none text-clarity">App Store</span>
                </span>
              </a>
            </div>
          </div>
        </section>

        {/* ── 3. Pull Quotes ── */}
        <section className="py-32 sm:py-40 bg-white">
          <div className="max-w-3xl mx-auto px-6">
            {[
              "You tried on four things. Left in the first one anyway. Thought about it all day.",
              "You sent the mirror selfie. She said \u201ccute !!!\u201d You know exactly what that means.",
              "You\u2019re already there. Already in it. And you can\u2019t stop wondering if the other one was better.",
            ].map((quote, i) => (
              <div key={i} className="fade-in-up">
                <p className="pull-quote text-3xl sm:text-4xl text-clarity leading-tight py-14 sm:py-16">
                  {quote}
                </p>
                {i < 2 && (
                  <span
                    className="editorial-rule"
                    style={{ backgroundColor: "rgba(26,26,26,0.15)" }}
                  />
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── 4. The Answer — Black bg, illustration left ── */}
        <section className="bg-clarity">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col lg:flex-row items-stretch">
              <div
                className="editorial-image relative flex-1 fade-in-up"
                style={{ minHeight: "60vh" }}
              >
                <Image
                  src={illustrationDuo}
                  alt="Two women choosing outfits — Or This? AI outfit feedback"
                  fill
                  className="object-cover object-top"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </div>
              <div className="flex-1 flex flex-col justify-center px-10 py-20 sm:px-16 fade-in-up">
                <span
                  className="editorial-rule mb-8"
                  style={{ backgroundColor: "#E85D4C" }}
                />
                <p className="section-label text-white/40 mb-6">
                  Your phone. Ten seconds. Done.
                </p>
                <h2 className="pull-quote text-5xl sm:text-6xl text-white leading-tight mb-10">
                  It tells you<br />the truth.
                </h2>
                <ul className="flex flex-col gap-6">
                  {[
                    "A score out of 10. No sugarcoating.",
                    "What\u2019s working, what isn\u2019t, and one thing to fix right now.",
                    "Keep asking until you\u2019re sure. \u2018Should I swap the shoes?\u2019 It doesn\u2019t care how many times you ask.",
                  ].map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-4 text-white/75 text-lg leading-relaxed"
                    >
                      <span
                        className="font-display text-xl flex-shrink-0 mt-0.5"
                        style={{ color: "#E85D4C" }}
                      >
                        &mdash;
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── 5. Editorial Grid — 4 illustrations ── */}
        <section className="py-24 sm:py-32 bg-white">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div
                className="row-span-2 editorial-image relative fade-in-up"
                style={{ minHeight: "600px" }}
              >
                <Image
                  src={illustrationBlue}
                  alt="Woman in dark tailored jacket — styled with confidence"
                  fill
                  className="object-cover object-top"
                  sizes="(max-width: 640px) 100vw, 50vw"
                />
                <div
                  className="absolute bottom-0 left-0 right-0 p-8"
                  style={{
                    background:
                      "linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 100%)",
                  }}
                >
                  <p className="pull-quote text-2xl sm:text-3xl text-white leading-tight">
                    &ldquo;Confidence in<br />every choice.&rdquo;
                  </p>
                </div>
              </div>

              <div
                className="editorial-image relative fade-in-up"
                style={{ minHeight: "290px" }}
              >
                <Image
                  src={illustrationTan}
                  alt="Woman looking over shoulder in styled outfit"
                  fill
                  className="object-cover object-top"
                  sizes="(max-width: 640px) 100vw, 50vw"
                />
              </div>

              <div
                className="editorial-image relative fade-in-up"
                style={{ minHeight: "290px" }}
              >
                <Image
                  src={illustrationPurple}
                  alt="Woman in editorial fashion — personal style advice"
                  fill
                  className="object-cover object-top"
                  sizes="(max-width: 640px) 100vw, 50vw"
                />
              </div>

              <div
                className="col-span-2 editorial-image relative fade-in-up"
                style={{ minHeight: "400px" }}
              >
                <Image
                  src={charlotaPhoto}
                  alt="Fashion editorial photograph — outfit inspiration by Charlota Blunarova"
                  fill
                  className="object-cover object-center"
                  sizes="(max-width: 640px) 100vw, 100vw"
                />
              </div>
            </div>
            <p className="text-xs text-center mt-4" style={{ color: "rgba(26,26,26,0.3)" }}>
              Photos by{" "}
              <a
                href="https://www.instagram.com/kuenzelzeller"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
                style={{ color: "rgba(26,26,26,0.4)" }}
              >
                Fabian Künzel-Zeller
              </a>
              {" "}·{" "}
              <a
                href="https://www.instagram.com/charlotablunarova"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
                style={{ color: "rgba(26,26,26,0.4)" }}
              >
                Charlota Blunarova
              </a>
            </p>
          </div>
        </section>

        {/* ── 5b. Style Guides — niche landing page links ── */}
        <section className="py-24 sm:py-32 bg-white">
          <div className="max-w-6xl mx-auto px-6">
            <div className="mb-14 fade-in-up">
              <span
                className="editorial-rule mb-8"
                style={{ backgroundColor: "#E85D4C", display: "block", width: 40 }}
              />
              <p className="section-label mb-4" style={{ color: "rgba(26,26,26,0.4)" }}>
                Style Guides
              </p>
              <h2 className="pull-quote text-4xl sm:text-5xl text-clarity leading-tight">
                Dressed for the moment.
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-gray-100 fade-in-up">
              {[
                { href: "/back-to-work", label: "Back to Work", sub: "After time away with kids" },
                { href: "/dating-again", label: "Dating Again", sub: "After divorce or a long relationship" },
                { href: "/back-to-office", label: "Back to Office", sub: "After years of working remote" },
                { href: "/postpartum-style", label: "Postpartum Style", sub: "Dressing your changing body" },
                { href: "/career-change", label: "Career Change", sub: "First day in a new industry" },
                { href: "/reinvention", label: "Reinvention", sub: "Starting a new chapter after 40" },
              ].map((guide) => (
                <Link
                  key={guide.href}
                  href={guide.href}
                  className="group block bg-white px-8 py-10 transition-colors hover:bg-cream"
                >
                  <p
                    className="text-base font-medium mb-1 transition-colors group-hover:text-coral"
                    style={{ color: "#1A1A1A" }}
                  >
                    {guide.label} →
                  </p>
                  <p className="text-sm" style={{ color: "rgba(26,26,26,0.4)" }}>
                    {guide.sub}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── 5c. Download / TestFlight ── */}
        <DownloadSection />

        {/* ── 6. Early Access — Black bg ── */}
        <section className="py-28 sm:py-36 bg-clarity" id="waitlist">
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-20 fade-in-up">
              <p className="section-label text-white/40 mb-6">First in gets more</p>
              <h2 className="pull-quote text-5xl sm:text-6xl text-white leading-tight mb-4">
                Join the waitlist now.
              </h2>
              <p className="text-white/50 text-lg">
                Your first month of Plus is on us.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 mb-20">
              {[
                {
                  symbol: "∞",
                  label: "Check as many looks as you want",
                  sub: "No daily cap.",
                },
                {
                  symbol: "✦",
                  label: "It learns your style over time",
                  sub: "Gets smarter every use.",
                },
                {
                  symbol: "◌",
                  label: "Keep asking until you\u2019re sure",
                  sub: "No limit on follow-ups.",
                },
              ].map((perk, i) => (
                <div
                  key={perk.label}
                  className={`fade-in-up px-8 py-10 ${i > 0 ? "border-l border-white/10" : ""}`}
                >
                  <p className="text-3xl mb-5 font-light" style={{ color: "rgba(255,255,255,0.2)" }}>
                    {perk.symbol}
                  </p>
                  <p className="text-white text-base font-medium mb-2 leading-snug">
                    {perk.label}
                  </p>
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
                    {perk.sub}
                  </p>
                </div>
              ))}
            </div>

            <div className="max-w-lg mx-auto fade-in-up">
              <WaitlistForm refCode={refCode} variant="dark" />
            </div>
          </div>
        </section>

        {/* ── 7. Portrait — Cinematic video, 21:9 ── */}
        <section
          className="relative w-full overflow-hidden"
          style={{ aspectRatio: "21/9" }}
        >
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="none"
            poster="/video/cinematic-poster.jpg"
            className="absolute inset-0 w-full h-full object-cover"
          >
            <source src="/video/5822800-hd_1920_1080_25fps.mp4" type="video/mp4" />
          </video>
          <div className="hero-overlay absolute inset-0" />
          <div className="relative h-full flex items-center justify-center text-center px-6">
            <h2 className="pull-quote text-4xl sm:text-6xl lg:text-7xl text-white leading-tight">
              Stop wondering.<br />Start knowing.
            </h2>
          </div>
        </section>

        {/* ── 8. Final CTA — White ── */}
        <section className="py-28 sm:py-36 bg-white">
          <div className="max-w-2xl mx-auto px-6 text-center">
            <div className="fade-in-up">
              <h2 className="pull-quote text-5xl sm:text-6xl text-clarity leading-tight mb-6">
                Your mirror can&apos;t tell&nbsp;you.<br />We can.
              </h2>
              <p className="text-lg mb-12 max-w-md mx-auto leading-relaxed" style={{ color: "rgba(45,45,45,0.5)" }}>
                Join the waitlist. Your first month of Plus is included.
              </p>
              <div className="max-w-md mx-auto text-left">
                <WaitlistForm refCode={refCode} variant="light" />
              </div>
            </div>
          </div>
        </section>

        {/* ── 9. Footer — White ── */}
        <footer className="border-t py-14 bg-white" style={{ borderColor: "rgba(26,26,26,0.1)" }}>
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 sm:gap-6 mb-10">
              <div>
                <Logo />
                <p className="text-sm mt-3 max-w-xs" style={{ color: "rgba(26,26,26,0.3)" }}>
                  Confidence in every choice.
                  <br />
                  Available now on iOS. Android coming soon.
                </p>
              </div>
              <div className="flex flex-col gap-2.5">
                <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: "rgba(26,26,26,0.3)" }}>
                  Company
                </p>
                <Link href="/learn" className="text-sm transition-colors hover:text-clarity" style={{ color: "rgba(26,26,26,0.4)" }}>
                  Learn
                </Link>
                <Link href="/privacy" className="text-sm transition-colors hover:text-clarity" style={{ color: "rgba(26,26,26,0.4)" }}>
                  Privacy Policy
                </Link>
                <Link href="/terms" className="text-sm transition-colors hover:text-clarity" style={{ color: "rgba(26,26,26,0.4)" }}>
                  Terms of Service
                </Link>
                <Link href="/support" className="text-sm transition-colors hover:text-clarity" style={{ color: "rgba(26,26,26,0.4)" }}>
                  Support
                </Link>
                <Link href="/delete-account" className="text-sm transition-colors hover:text-clarity" style={{ color: "rgba(26,26,26,0.4)" }}>
                  Delete Account
                </Link>
              </div>
              <div className="flex flex-col gap-2.5">
                <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: "rgba(26,26,26,0.3)" }}>
                  Style Guides
                </p>
                {[
                  { href: "/back-to-work", label: "Back to Work" },
                  { href: "/dating-again", label: "Dating Again" },
                  { href: "/back-to-office", label: "Back to Office" },
                  { href: "/postpartum-style", label: "Postpartum Style" },
                  { href: "/career-change", label: "Career Change" },
                  { href: "/reinvention", label: "Reinvention" },
                ].map((g) => (
                  <Link key={g.href} href={g.href} className="text-sm transition-colors hover:text-clarity" style={{ color: "rgba(26,26,26,0.4)" }}>
                    {g.label}
                  </Link>
                ))}
              </div>
              <div className="flex flex-col gap-2.5">
                <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: "rgba(26,26,26,0.3)" }}>
                  Follow
                </p>
                <div className="flex items-center gap-4">
                  <a
                    href="https://x.com/OrThisApp"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="X (Twitter)"
                    className="transition-colors hover:text-clarity"
                    style={{ color: "rgba(26,26,26,0.2)" }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.741l7.73-8.835L1.254 2.25H8.08l4.259 5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  </a>
                  <a
                    href="https://www.tiktok.com/@or_this"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="TikTok"
                    className="transition-colors hover:text-clarity"
                    style={{ color: "rgba(26,26,26,0.2)" }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.27 8.27 0 004.84 1.55V6.77a4.85 4.85 0 01-1.07-.08z" />
                    </svg>
                  </a>
                  <a
                    href="https://www.pinterest.com/OrThisApp/"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Pinterest"
                    className="transition-colors hover:text-clarity"
                    style={{ color: "rgba(26,26,26,0.2)" }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
            <div className="border-t pt-6 text-center" style={{ borderColor: "rgba(26,26,26,0.1)" }}>
              <p className="text-xs" style={{ color: "rgba(26,26,26,0.2)" }}>
                &copy; {new Date().getFullYear()} Or This? All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </ScrollRevealWrapper>
  );
}
