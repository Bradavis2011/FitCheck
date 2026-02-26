import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Or This?",
  alternates: { canonical: "/privacy" },
};

const EFFECTIVE_DATE = "February 17, 2026";

export default function PrivacyPage() {
  return (
    <div style={{ backgroundColor: "#FBF7F4", minHeight: "100vh" }}>
      <nav className="flex items-center justify-between px-6 py-5 max-w-3xl mx-auto">
        <Link href="/" className="text-xl font-medium">
          <span style={{ color: "#1A1A1A" }}>Or </span>
          <span className="font-display italic" style={{ color: "#E85D4C" }}>This?</span>
        </Link>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-display italic mb-2" style={{ color: "#1A1A1A" }}>Privacy Policy</h1>
        <p className="text-xs uppercase tracking-widest mb-10" style={{ color: "#9B9B9B" }}>Effective {EFFECTIVE_DATE}</p>

        <div className="prose-custom space-y-8">
          <Section title="1. Overview">
            <p>Or This? (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is an AI-powered outfit feedback application. This Privacy Policy explains how we collect, use, and protect your information when you use the Or This? mobile application and website at orthis.app.</p>
            <p>By using Or This?, you agree to the collection and use of information in accordance with this policy.</p>
          </Section>

          <Section title="2. Information We Collect">
            <p><strong>Account information:</strong> When you create an account, we collect your email address and name through our authentication provider (Clerk).</p>
            <p><strong>Outfit photos:</strong> When you submit an outfit for analysis, we process the photo you provide. Photos are stored securely in Cloudflare R2 object storage.</p>
            <p><strong>Usage data:</strong> We collect information about how you use the app, including outfit check history, scores, feedback interactions, and feature usage.</p>
            <p><strong>Device information:</strong> We may collect basic device information such as operating system and app version for troubleshooting purposes.</p>
          </Section>

          <Section title="3. How We Use Your Information">
            <ul>
              <li>To provide AI-powered outfit analysis using Google Gemini</li>
              <li>To maintain your outfit history and style profile</li>
              <li>To process subscription payments through RevenueCat and the App Store / Google Play</li>
              <li>To improve the app and AI feedback quality</li>
              <li>To communicate important updates about the service</li>
            </ul>
          </Section>

          <Section title="4. AI Processing">
            <p>Outfit photos you submit are sent to Google&apos;s Gemini API for analysis. Google&apos;s privacy policy governs their handling of this data. We do not use your photos to train AI models. Analysis results are stored in our database linked to your account.</p>
          </Section>

          <Section title="5. Data Sharing">
            <p>We do not sell your personal data. We share data only with:</p>
            <ul>
              <li><strong>Clerk</strong> — authentication and user management</li>
              <li><strong>Google Gemini</strong> — AI outfit analysis</li>
              <li><strong>Cloudflare R2</strong> — image storage</li>
              <li><strong>Railway</strong> — database and API hosting</li>
              <li><strong>RevenueCat</strong> — subscription management</li>
            </ul>
            <p>If you choose to share outfits publicly in the Community Feed, your username and outfit data will be visible to other users.</p>
          </Section>

          <Section title="6. Data Retention">
            <p>Free tier users: outfit history is retained for 7 days. Plus and Pro subscribers retain full history. You can delete your account and all associated data at any time from the Profile screen.</p>
          </Section>

          <Section title="7. Your Rights">
            <p>You have the right to access, correct, or delete your personal data. To exercise these rights, delete your account from within the app or contact us at privacy@orthis.app.</p>
          </Section>

          <Section title="8. Children's Privacy">
            <p>Or This? is not directed to children under 13. We do not knowingly collect personal information from children under 13. If you become aware that a child has provided us with personal data, please contact us.</p>
          </Section>

          <Section title="9. Changes to This Policy">
            <p>We may update this Privacy Policy from time to time. We will notify you of significant changes by updating the effective date and, where appropriate, through the app. Continued use of Or This? after changes constitutes acceptance of the updated policy.</p>
          </Section>

          <Section title="10. Contact">
            <p>Questions about this Privacy Policy? Contact us at <a href="mailto:privacy@orthis.app" style={{ color: "#E85D4C" }}>privacy@orthis.app</a>.</p>
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
