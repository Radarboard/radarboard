import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig from "../../packages/tsconfig/vitest.shared";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      coverage: {
        exclude: [
          "src/dev-server.ts",
          "src/server.ts",
          "src/vercel-entry.ts",
          "src/cloudflare-entry.ts",
          "scripts/**",
        ],
        thresholds: {
          statements: 95,
          branches: 85,
          functions: 95,
          lines: 95,
        },
      },
    },
  })
);
