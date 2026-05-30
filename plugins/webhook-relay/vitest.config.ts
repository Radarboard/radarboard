import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig from "../../packages/tsconfig/vitest.shared";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      coverage: {
        thresholds: {
          statements: 24.5,
          branches: 18.7,
          functions: 21.8,
          lines: 25.8,
        },
      },
    },
  })
);
