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
      fileParallelism: false,
      include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
      maxWorkers: 1,
      pool: "threads",
      environmentMatchGlobs: [["src/**/*.test.tsx", "jsdom"]],
      setupFiles: ["./vitest.jsdom-setup.ts"],
      coverage: {
        thresholds: {
          "src/blueprints/apply.ts": {
            statements: 95,
            branches: 90,
            functions: 100,
            lines: 95,
          },
          "src/blueprints/registry.ts": {
            statements: 80,
            branches: 75,
            functions: 100,
            lines: 80,
          },
        },
      },
    },
  })
);
