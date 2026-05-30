import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig from "../../packages/tsconfig/vitest.shared";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      coverage: {
        thresholds: {
          statements: 93.6,
          branches: 87.7,
          functions: 81.8,
          lines: 94.8,
        },
      },
    },
  })
);
