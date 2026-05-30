import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig from "../../packages/tsconfig/vitest.shared";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      coverage: {
        thresholds: {
          statements: 64.5,
          branches: 50,
          functions: 30.7,
          lines: 63.3,
        },
      },
    },
  })
);
