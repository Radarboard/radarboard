import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig from "../../packages/tsconfig/vitest.shared";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      coverage: {
        thresholds: {
          statements: 9.8,
          branches: 1,
          functions: 2.6,
          lines: 10.1,
        },
      },
    },
  })
);
