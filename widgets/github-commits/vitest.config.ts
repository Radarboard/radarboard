import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig from "../../packages/tsconfig/vitest.shared";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      coverage: {
        exclude: ["src/**/*.stories.tsx"],
        thresholds: {
          statements: 75.2,
          branches: 51.4,
          functions: 74.2,
          lines: 74.1,
        },
      },
    },
  })
);
