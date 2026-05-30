import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig from "../../packages/tsconfig/vitest.shared";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      coverage: {
        thresholds: {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
      },
    },
  })
);
