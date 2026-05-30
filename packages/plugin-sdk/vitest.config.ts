import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig from "../../packages/tsconfig/vitest.shared";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      coverage: {
        thresholds: {
          statements: 34.5,
          branches: 19,
          functions: 21.6,
          lines: 35.6,
        },
      },
    },
  })
);
