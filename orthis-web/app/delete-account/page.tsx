import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Delete Account — Or This?",
  description: "How to delete your Or This? account and all associated data.",
  alternates: { canonical: "/delete-account" },
};

export default function DeleteAccountPage() {
  return (
    <div style={{ backgroundColor: "#FBF7F4", minHeight: "100vh" }}>
      <nav className="flex items-center justify-between px-6 py-5 max-w-3xl mx-auto">
        <Link href="/" className="text-xl font-medium">
          <span style={{ color: "#1A1A1A" }}>Or </span>
          <span className="font-display italic" style={{ color: "#E85D4C" }}>This?</span>
        </Link>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold mb-4" style={{ color: "#1A1A1A" }}>Delete Your Account</h1>
        <p className="text-lg mb-10" style={{ color: "#555" }}>
          You can delete your Or This? account and all associated data at any time. Here&apos;s how.
        </p>

        {/* In-app deletion */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4" style={{ color: "#1A1A1A" }}>Option 1 — Delete In-App (Recommended)</h2>
          <p className="mb-4" style={{ color: "#555" }}>
            The fastest way to delete your account is directly inside the Or This? app:
          </p>
          <ol className="list-decimal list-inside space-y-2" style={{ color: "#555" }}>
            <li>Open the <strong>Or This?</strong> app on your device.</li>
            <li>Tap <strong>Profile</strong> (bottom-right tab).</li>
            <li>Scroll down and tap <strong>Settings</strong>.</li>
            <li>Tap <strong>Privacy &amp; Data</strong>.</li>
            <li>Tap <strong>Delete Account</strong> and confirm.</li>
          </ol>
          <p className="mt-4 text-sm" style={{ color: "#9B9B9B" }}>
            Your account and all data will be permanently deleted immediately. This action cannot be undone.
          </p>
        </section>

        {/* Email deletion */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4" style={{ color: "#1A1A1A" }}>Option 2 — Request via Email</h2>
          <p className="mb-4" style={{ color: "#555" }}>
            If you no longer have access to the app, email us and we will delete your account within 30 days:
          </p>
          <a
            href="mailto:support@orthis.app?subject=Delete%20My%20Account&body=Please%20delete%20my%20Or%20This%3F%20account%20and%20all%20associated%20data.%20My%20registered%20email%20address%20is%3A%20"
            className="inline-block px-6 py-3 rounded-full font-semibold text-white"
            style={{ backgroundColor: "#E85D4C" }}
          >
            Email support@orthis.app
          </a>
        </section>

        {/* What gets deleted */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4" style={{ color: "#1A1A1A" }}>What Gets Deleted</h2>
          <p className="mb-3" style={{ color: "#555" }}>When you delete your account, the following data is permanently removed:</p>
          <ul className="list-disc list-inside space-y-1" style={{ color: "#555" }}>
            <li>Your profile (name, email, username)</li>
            <li>All outfit photos and AI analysis results</li>
            <li>Your outfit history and scores</li>
            <li>Community posts and comparison posts you shared</li>
            <li>Your inner circle connections</li>
            <li>Push notification tokens</li>
            <li>Subscription and usage records</li>
          </ul>
          <p className="mt-4 text-sm" style={{ color: "#9B9B9B" }}>
            Subscription billing records may be retained by Apple App Store or Google Play as required by their policies.
            Aggregated, anonymised analytics data (not linked to your identity) may be retained.
          </p>
        </section>

        {/* Clear history only */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4" style={{ color: "#1A1A1A" }}>Clear History Without Deleting Account</h2>
          <p style={{ color: "#555" }}>
            If you only want to delete your outfit history but keep your account, go to{" "}
            <strong>Profile → Settings → Privacy &amp; Data → Clear Outfit History</strong> in the app.
            This deletes all outfit photos and analysis results while keeping your account active.
          </p>
        </section>

        <div className="mt-12 pt-8 border-t" style={{ borderColor: "#E8E0D8" }}>
          <p className="text-sm" style={{ color: "#9B9B9B" }}>
            For any other privacy-related requests, please review our{" "}
            <Link href="/privacy" className="underline" style={{ color: "#E85D4C" }}>Privacy Policy</Link>{" "}
            or contact{" "}
            <a href="mailto:support@orthis.app" className="underline" style={{ color: "#E85D4C" }}>support@orthis.app</a>.
          </p>
        </div>
      </main>
    </div>
  );
}
