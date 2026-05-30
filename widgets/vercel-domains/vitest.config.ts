import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig from "../../packages/tsconfig/vitest.shared";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      coverage: {
        exclude: ["src/**/*.stories.tsx"],
        thresholds: {
          statements: 94.7,
          branches: 62.5,
          functions: 100,
          lines: 100,
        },
      },
    },
  })
);
