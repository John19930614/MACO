import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // maplibre-gl ships its own worker; keep it external from the server bundle.
  serverExternalPackages: ["maplibre-gl"],
  eslint: {
    // Lint is run explicitly in CI; do not block production builds on it.
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
