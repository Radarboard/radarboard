import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig from "../../packages/tsconfig/vitest.shared";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      coverage: {
        thresholds: {
          statements: 69,
          branches: 61.3,
          functions: 75.2,
          lines: 71.7,
        },
      },
    },
  })
);
