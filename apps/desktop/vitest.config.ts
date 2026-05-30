import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig from "../../packages/tsconfig/vitest.shared";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      include: ["scripts/**/*.test.ts"],
      coverage: {
        include: ["scripts/**/*.mjs"],
        thresholds: {
          statements: 69.7,
          branches: 60,
          functions: 40,
          lines: 69.2,
        },
      },
    },
  })
);
