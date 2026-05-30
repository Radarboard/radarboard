import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig from "../../packages/tsconfig/vitest.shared";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      include: ["src/**/*.test.ts"],
      coverage: {
        thresholds: {
          statements: 48.9,
          branches: 23.5,
          functions: 66.6,
          lines: 48.3,
        },
      },
    },
  })
);
