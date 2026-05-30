import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig from "../../packages/tsconfig/vitest.shared";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      coverage: {
        thresholds: {
          statements: 73.5,
          branches: 63.3,
          functions: 62.5,
          lines: 77,
        },
      },
    },
  })
);
