import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig from "../../packages/tsconfig/vitest.shared";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      coverage: {
        thresholds: {
          statements: 65.5,
          branches: 46.9,
          functions: 81.3,
          lines: 70,
        },
      },
    },
  })
);
