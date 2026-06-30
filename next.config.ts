import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // maplibre-gl ships its own worker; keep it external from the server bundle.
  serverExternalPackages: ["maplibre-gl"],
  eslint: {
    // Lint is run explicitly in CI; do not block production builds on it.
    ignoreDuringBuilds: false,
  },
  experimental: {
    // Forms that attach an image (e.g. the dev-task "visual reference" and the
    // waste-profile wizard) send it inline as a base64 data URL in the Server
    // Action body. Next.js caps Server Action bodies at 1 MB by default, which a
    // single screenshot easily exceeds (→ 413 "Body exceeded 1 MB limit"). Raise
    // it so normal image attachments go through.
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
