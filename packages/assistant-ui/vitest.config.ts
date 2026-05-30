import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig from "../../packages/tsconfig/vitest.shared";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      coverage: {
        thresholds: {
          statements: 6.8,
          branches: 6.6,
          functions: 4.6,
          lines: 7.2,
        },
      },
    },
  })
);
