import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig from "../../packages/tsconfig/vitest.shared";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      include: ["src/**/*.test.ts"],
      coverage: {
        thresholds: {
          statements: 94.4,
          branches: 71.4,
          functions: 100,
          lines: 100,
        },
      },
    },
  })
);
