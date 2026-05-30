import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig from "../../packages/tsconfig/vitest.shared";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      coverage: {
        thresholds: {
          statements: 54.1,
          branches: 37.8,
          functions: 59.7,
          lines: 52.1,
        },
      },
    },
  })
);
