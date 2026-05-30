import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig from "../../packages/tsconfig/vitest.shared";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      coverage: {
        exclude: ["src/**/*.stories.tsx"],
        thresholds: {
          statements: 59.7,
          branches: 33.7,
          functions: 55.5,
          lines: 60.9,
        },
      },
    },
  })
);
