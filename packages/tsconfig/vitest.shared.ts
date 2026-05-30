import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const failOnConsoleSetup = fileURLToPath(new URL("./vitest.fail-on-console.ts", import.meta.url));

/**
 * Shared vitest base configuration for all packages.
 *
 * Extend in each package:
 *   import { defineConfig, mergeConfig } from "vitest/config";
 *   import sharedConfig from "@radarboard/tsconfig/vitest.shared";
 *   export default mergeConfig(sharedConfig, defineConfig({ ... }));
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["node_modules", "dist", ".next"],
    setupFiles: [failOnConsoleSetup],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "lcov", "json-summary"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        "src/**/*.d.ts",
        "src/**/index.ts",
        "src/**/types.ts",
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
    restoreMocks: true,
  },
});
