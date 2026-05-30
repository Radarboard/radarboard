import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig from "../../packages/tsconfig/vitest.shared";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      coverage: {
        thresholds: {
          statements: 44,
          branches: 43,
          functions: 46.1,
          lines: 46.5,
        },
      },
    },
  })
);
