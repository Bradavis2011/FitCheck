import type { NextConfig } from "next";
import path from "path";

// Set outputFileTracingRoot to the repo root so Vercel can trace files
// across the monorepo (e.g. shared assets, API). Do NOT set turbopack.root —
// pointing it at the parent directory causes Turbopack to panic with
// "Dependency tracking is disabled so invalidation is not allowed".
const MONOREPO_ROOT = path.resolve(__dirname, "..");

const nextConfig: NextConfig = {
  outputFileTracingRoot: MONOREPO_ROOT,
  async redirects() {
    return [
      // Journal is merged into Learn — all journal traffic redirects permanently
      { source: '/journal', destination: '/learn', permanent: true },
      { source: '/journal/:slug', destination: '/learn/:slug', permanent: true },
    ];
  },
  webpack(config) {
    // Allow .js imports to resolve .ts/.tsx files (required for moduleResolution: "bundler")
    config.resolve.extensionAlias = {
      ".js": [".js", ".ts", ".tsx"],
      ".jsx": [".jsx", ".tsx"],
    };
    return config;
  },
};

export default nextConfig;
