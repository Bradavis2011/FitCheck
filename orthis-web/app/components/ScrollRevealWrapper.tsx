"use client";

import { useRef, useEffect, type ReactNode } from "react";

export default function ScrollRevealWrapper({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.classList.add("js");
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("visible");
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -20px 0px" }
    );

    const items = el.querySelectorAll(".fade-in-up");
    items.forEach((item) => observer.observe(item));

    return () => observer.disconnect();
  }, []);

  return <div ref={ref}>{children}</div>;
}
