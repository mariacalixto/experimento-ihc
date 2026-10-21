import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Quick Tunnels use a random single-label host; this only permits dev origins.
  allowedDevOrigins: ["*.trycloudflare.com"],
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
