import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support — Or This?",
  alternates: { canonical: "/support" },
};

export default function SupportPage() {
  return (
    <div style={{ backgroundColor: "#FBF7F4", minHeight: "100vh" }}>
      <nav className="flex items-center justify-between px-6 py-5 max-w-3xl mx-auto">
        <Link href="/" className="text-xl font-medium">
          <span style={{ color: "#1A1A1A" }}>Or </span>
          <span className="font-display italic" style={{ color: "#E85D4C" }}>This?</span>
        </Link>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-display italic mb-2" style={{ color: "#1A1A1A" }}>Support</h1>
        <p className="text-xs uppercase tracking-widest mb-10" style={{ color: "#9B9B9B" }}>We&apos;re here to help.</p>

        <div className="space-y-10">
          <Section title="Contact Us">
            <p>
              Email us at{" "}
              <a href="mailto:support@orthis.app" style={{ color: "#E85D4C" }}>
                support@orthis.app
              </a>{" "}
              and we&apos;ll get back to you within 1–2 business days.
            </p>
          </Section>

          <Section title="Frequently Asked Questions">
            <FAQ q="How many outfit checks do I get?">
              Free accounts get 3 outfit checks per day. Plus and Pro subscribers get unlimited checks.
            </FAQ>
            <FAQ q="How do I delete my account?">
              You can delete your account and all associated data from the Profile screen in the app, or visit{" "}
              <Link href="/delete-account" style={{ color: "#E85D4C" }}>orthis.app/delete-account</Link>.
            </FAQ>
            <FAQ q="Why isn't my photo uploading?">
              Make sure the app has camera and photo library permissions enabled in your device settings. Photos must be under 10MB.
            </FAQ>
            <FAQ q="How do I cancel my subscription?">
              Subscriptions are managed through the App Store (iOS) or Google Play (Android). Go to your device&apos;s subscription settings to cancel. Your access continues until the end of the current billing period.
            </FAQ>
            <FAQ q="Is my photo data private?">
              Yes. Your outfit photos are stored securely and never shared with third parties or used to train AI models. See our{" "}
              <Link href="/privacy" style={{ color: "#E85D4C" }}>Privacy Policy</Link> for full details.
            </FAQ>
          </Section>
        </div>

        <div className="mt-16 pt-8 border-t" style={{ borderColor: "#E8E8E8" }}>
          <Link href="/" className="text-sm font-medium" style={{ color: "#E85D4C" }}>← Back to Or This?</Link>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t pt-6" style={{ borderColor: "#E8E8E8" }}>
      <h2 className="text-xs font-medium uppercase tracking-widest mb-4" style={{ color: "#9B9B9B" }}>{title}</h2>
      <div className="space-y-4 text-base leading-relaxed" style={{ color: "#2D2D2D" }}>
        {children}
      </div>
    </div>
  );
}

function FAQ({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1 border-b pb-4" style={{ borderColor: "#E8E8E8" }}>
      <p className="font-medium" style={{ color: "#1A1A1A" }}>{q}</p>
      <p style={{ color: "#2D2D2D" }}>{children}</p>
    </div>
  );
}
