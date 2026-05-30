import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig from "../../packages/tsconfig/vitest.shared";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      coverage: {
        thresholds: {
          statements: 29.7,
          branches: 19.9,
          functions: 20.4,
          lines: 30.8,
        },
      },
    },
  })
);
