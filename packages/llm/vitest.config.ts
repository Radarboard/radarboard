import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig from "../../packages/tsconfig/vitest.shared";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      include: ["src/**/*.test.ts"],
      coverage: {
        thresholds: {
          statements: 85.7,
          branches: 71.1,
          functions: 94.1,
          lines: 85.3,
        },
      },
    },
  })
);
