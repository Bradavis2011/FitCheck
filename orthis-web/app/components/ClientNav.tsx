"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

function Logo() {
  return (
    <span className="text-xl select-none">
      <span className="font-sans font-medium text-clarity">Or </span>
      <span className="font-display italic text-coral">This?</span>
    </span>
  );
}

export default function ClientNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToWaitlist = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById("waitlist")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <nav className={`nav-sticky fixed top-0 left-0 right-0 z-50 ${scrolled ? "scrolled" : ""}`}>
      <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-6">
          <Link
            href="/try"
            className="text-sm font-medium transition-colors"
            style={{ color: "rgba(26,26,26,0.5)" }}
          >
            Try
          </Link>
          <Link
            href="/learn"
            className="text-sm font-medium transition-colors"
            style={{ color: "rgba(26,26,26,0.5)" }}
          >
            Learn
          </Link>
          <a
            href="#waitlist"
            onClick={scrollToWaitlist}
            className="text-sm font-medium transition-colors"
            style={{ color: "rgba(26,26,26,0.5)" }}
          >
            Join
          </a>
          <a
            href="https://apps.apple.com/app/or-this/id6742406265"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-white px-4 py-2 transition-opacity hover:opacity-80"
            style={{ backgroundColor: "#1A1A1A", borderRadius: 0 }}
          >
            Download
          </a>
        </div>
      </div>
    </nav>
  );
}
