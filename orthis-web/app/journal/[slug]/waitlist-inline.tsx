"use client";

import { useState } from "react";

export default function WaitlistInline() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Something went wrong.");
        setStatus("error");
        return;
      }
      setStatus("success");
    } catch {
      setErrorMsg("Network error. Please try again.");
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <p className="text-sm font-medium" style={{ color: "#E85D4C" }}>
        You&apos;re on the list. We&apos;ll be in touch.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-0 max-w-md">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        required
        disabled={status === "loading"}
        className="flex-1 px-4 py-3 text-sm border outline-none"
        style={{
          borderColor: "rgba(255,255,255,0.2)",
          backgroundColor: "rgba(255,255,255,0.08)",
          color: "#fff",
        }}
      />
      <button
        type="submit"
        disabled={status === "loading"}
        className="px-6 py-3 text-xs font-medium uppercase tracking-wider flex-shrink-0"
        style={{ backgroundColor: "#E85D4C", color: "#fff" }}
      >
        {status === "loading" ? "..." : "Join"}
      </button>
      {errorMsg && (
        <p className="text-xs mt-2 w-full" style={{ color: "#FCA5A5" }}>
          {errorMsg}
        </p>
      )}
    </form>
  );
}
