import type { NextConfig } from "next";
import path from "path";

// Set outputFileTracingRoot to the repo root so Vercel can trace files
// across the monorepo (e.g. shared assets, API). Do NOT set turbopack.root —
// pointing it at the parent directory causes Turbopack to panic with
// "Dependency tracking is disabled so invalidation is not allowed".
const MONOREPO_ROOT = path.resolve(__dirname, "..");

const nextConfig: NextConfig = {
  outputFileTracingRoot: MONOREPO_ROOT,
};

export default nextConfig;
