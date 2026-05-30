import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig from "../../packages/tsconfig/vitest.shared";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      coverage: {
        exclude: ["src/**/*.stories.tsx"],
        thresholds: {
          statements: 90,
          branches: 72.9,
          functions: 90.9,
          lines: 96.4,
        },
      },
    },
  })
);
