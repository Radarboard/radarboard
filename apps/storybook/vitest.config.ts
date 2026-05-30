import { resolve } from "node:path";
import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig from "../../packages/tsconfig/vitest.shared";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    esbuild: {
      tsconfigRaw: {
        compilerOptions: {
          jsx: "react-jsx",
          jsxImportSource: "react",
        },
      },
    },
    test: {
      include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
      coverage: {
        include: ["src/**/*.ts", "src/**/*.tsx"],
        exclude: ["src/mocks/**/*.ts", "src/mocks/**/*.tsx"],
        thresholds: {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
      },
    },
    resolve: {
      alias: {
        "@": resolve(__dirname, "."),
      },
    },
  })
);
