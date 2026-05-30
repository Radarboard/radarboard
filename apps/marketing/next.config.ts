import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["radarboard-marketing.localhost", "*.radarboard-marketing.localhost"],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
