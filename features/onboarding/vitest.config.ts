import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig from "../../packages/tsconfig/vitest.shared";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      coverage: {
        exclude: [
          "src/**/*.test.ts",
          "src/**/*.test.tsx",
          "src/**/*.d.ts",
          "src/**/*.stories.*",
          "src/**/*.scaffold.*",
          "src/**/index.ts",
          "src/types.ts",
          "src/profile-config.ts",
        ],
        thresholds: {
          statements: 90,
          branches: 75,
          functions: 85,
          lines: 90,
        },
      },
    },
  })
);
