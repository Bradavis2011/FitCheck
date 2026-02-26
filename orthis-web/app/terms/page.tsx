import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Or This?",
  alternates: { canonical: "/terms" },
};

const EFFECTIVE_DATE = "February 17, 2026";

export default function TermsPage() {
  return (
    <div style={{ backgroundColor: "#FBF7F4", minHeight: "100vh" }}>
      <nav className="flex items-center justify-between px-6 py-5 max-w-3xl mx-auto">
        <Link href="/" className="text-xl font-medium">
          <span style={{ color: "#1A1A1A" }}>Or </span>
          <span className="font-display italic" style={{ color: "#E85D4C" }}>This?</span>
        </Link>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-display italic mb-2" style={{ color: "#1A1A1A" }}>Terms of Service</h1>
        <p className="text-xs uppercase tracking-widest mb-10" style={{ color: "#9B9B9B" }}>Effective {EFFECTIVE_DATE}</p>

        <div className="space-y-8">
          <Section title="1. Acceptance of Terms">
            <p>By downloading, installing, or using Or This? (&quot;the App&quot;), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the App.</p>
          </Section>

          <Section title="2. Description of Service">
            <p>Or This? is an AI-powered outfit feedback application that provides style analysis, scoring, and recommendations based on photos you submit. The App uses artificial intelligence to generate feedback and is intended for personal, non-commercial use.</p>
          </Section>

          <Section title="3. User Accounts">
            <p>You must create an account to use Or This?. You are responsible for maintaining the security of your account credentials. You must provide accurate information and must be at least 13 years old to use the service.</p>
          </Section>

          <Section title="4. User Content">
            <p>By submitting photos to Or This?, you grant us a limited license to process and store those photos for the purpose of providing AI feedback. You retain ownership of your photos.</p>
            <p>You agree not to submit photos that contain illegal content, explicit material involving minors, or content that violates the rights of others.</p>
          </Section>

          <Section title="5. Community Features">
            <p>If you choose to share outfits publicly in the Community Feed, you agree to follow our community guidelines. We reserve the right to remove content that violates these guidelines. Shared outfits must be your own and must not contain inappropriate content.</p>
          </Section>

          <Section title="6. Subscriptions and Payments">
            <p>Or This? offers free and paid subscription tiers. Paid subscriptions are billed through the App Store (iOS) or Google Play (Android) and are subject to their respective terms. Subscriptions auto-renew unless cancelled at least 24 hours before the renewal date.</p>
            <p>Refunds are handled per the App Store and Google Play refund policies. We do not process refunds directly.</p>
          </Section>

          <Section title="7. AI Feedback Disclaimer">
            <p>AI-generated feedback is for informational and entertainment purposes only. Style recommendations are subjective and should not be the sole basis for important decisions. We do not guarantee the accuracy or appropriateness of any AI-generated content.</p>
          </Section>

          <Section title="8. Intellectual Property">
            <p>The Or This? app, brand, and all related content are owned by us and protected by intellectual property laws. You may not reproduce, distribute, or create derivative works from our content without permission.</p>
          </Section>

          <Section title="9. Limitation of Liability">
            <p>To the fullest extent permitted by law, Or This? shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the App. Our total liability to you shall not exceed the amount you paid for the service in the past 12 months.</p>
          </Section>

          <Section title="10. Termination">
            <p>We reserve the right to suspend or terminate accounts that violate these Terms. You may delete your account at any time from the Profile screen. Upon termination, your data will be deleted in accordance with our Privacy Policy.</p>
          </Section>

          <Section title="11. Changes to Terms">
            <p>We may update these Terms from time to time. Continued use of Or This? after changes are posted constitutes acceptance of the updated Terms.</p>
          </Section>

          <Section title="12. Contact">
            <p>Questions about these Terms? Contact us at <a href="mailto:legal@orthis.app" style={{ color: "#E85D4C" }}>legal@orthis.app</a>.</p>
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
      <div className="space-y-3 text-base leading-relaxed" style={{ color: "#2D2D2D" }}>
        {children}
      </div>
    </div>
  );
}
