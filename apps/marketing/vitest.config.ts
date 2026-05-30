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
      include: [
        "app/**/*.test.ts",
        "hooks/**/*.test.ts",
        "hooks/**/*.test.tsx",
        "data/**/*.test.ts",
      ],
      coverage: {
        include: ["app/api/**/*.ts", "hooks/**/*.ts", "data/**/*.ts"],
        thresholds: {
          statements: 67.1,
          branches: 65.7,
          functions: 55.5,
          lines: 69,
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
