import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig from "../../packages/tsconfig/vitest.shared";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      coverage: {
        exclude: ["src/**/*.stories.tsx"],
        thresholds: {
          statements: 83.5,
          branches: 66,
          functions: 95.6,
          lines: 90.1,
        },
      },
    },
  })
);
