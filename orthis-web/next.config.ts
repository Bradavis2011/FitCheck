import type { NextConfig } from "next";
import path from "path";

// Vercel sets outputFileTracingRoot to the repo root (/vercel/path0).
// turbopack.root must match exactly or Turbopack panics at build time.
// Both are set to the monorepo root (one level above orthis-web/).
const MONOREPO_ROOT = path.resolve(__dirname, "..");

const nextConfig: NextConfig = {
  outputFileTracingRoot: MONOREPO_ROOT,
  turbopack: {
    root: MONOREPO_ROOT,
  },
};

export default nextConfig;
