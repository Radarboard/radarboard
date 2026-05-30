import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig from "../../packages/tsconfig/vitest.shared";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      coverage: {
        thresholds: {
          statements: 13.6,
          branches: 10.3,
          functions: 14.3,
          lines: 13.4,
        },
      },
    },
  })
);
