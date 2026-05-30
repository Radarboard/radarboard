import type { NextConfig } from "next";
import { transpilePackages } from "./lib/extensions/runtime/transpile-packages";

const nextConfig: NextConfig = {
  output: "standalone",
  distDir:
    process.env.RADARBOARD_E2E === "1"
      ? ".next-e2e"
      : process.env.NODE_ENV === "development"
        ? ".next-dev"
        : ".next",
  serverExternalPackages: ["@libsql/client"],
  outputFileTracingExcludes: {
    "/*": ["./next.config.ts"],
    "/instrumentation": ["./next.config.ts"],
    instrumentation: ["./next.config.ts"],
    "instrumentation.js": ["./next.config.ts"],
  },
  experimental: {
    prefetchInlining: true,
  },
  transpilePackages,
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
