import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig from "../../packages/tsconfig/vitest.shared";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      coverage: {
        thresholds: {
          statements: 90.6,
          branches: 85,
          functions: 92,
          lines: 90.1,
        },
      },
    },
  })
);
