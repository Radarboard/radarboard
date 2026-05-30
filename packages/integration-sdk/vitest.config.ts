import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig from "../../packages/tsconfig/vitest.shared";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      coverage: {
        thresholds: {
          statements: 80.4,
          branches: 83.3,
          functions: 71.4,
          lines: 79.4,
        },
      },
    },
  })
);
