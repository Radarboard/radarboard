/* biome-ignore-all lint/style/noDefaultExport: Storybook config modules require default exports. */

import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/nextjs-vite";
import { defineMain } from "@storybook/nextjs-vite/node";
import { mergeConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { storyWatcherPlugin } from "../src/vite-plugin-story-watcher.ts";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const storybookNuqsEntry = fileURLToPath(import.meta.resolve("nuqs"));
const storybookNuqsNextAdapterEntry = fileURLToPath(import.meta.resolve("nuqs/adapters/next"));

const config: StorybookConfig = defineMain({
  stories: ["../.generated/**/*.stories.@(ts|tsx)"],
  addons: [
    "@storybook/addon-a11y",
    "@storybook/addon-docs",
    "@storybook/addon-mcp",
    "@storybook/addon-vitest",
  ],
  framework: {
    name: "@storybook/nextjs-vite",
    options: {},
  },
  typescript: {
    check: false,
  },
  async viteFinal(config) {
    const monorepoRoot = path.resolve(configDir, "../../..");
    return mergeConfig(config, {
      define: {
        __dirname: JSON.stringify("/"),
      },
      server: {
        fs: {
          allow: [monorepoRoot],
        },
        watch: {
          ignored: ["**/node_modules/**", "**/.git/**"],
        },
      },
      resolve: {
        alias: [
          {
            find: "@/app/providers",
            replacement: path.resolve(configDir, "../src/mocks/app-providers.tsx"),
          },
          {
            find: "next/navigation",
            replacement: path.resolve(configDir, "../src/mocks/next-navigation.ts"),
          },
          {
            find: "next/dynamic",
            replacement: path.resolve(configDir, "../src/mocks/next-dynamic.tsx"),
          },
          {
            find: "next/image",
            replacement: path.resolve(configDir, "../src/mocks/next-image.tsx"),
          },
          {
            find: "nuqs/adapters/next",
            replacement: storybookNuqsNextAdapterEntry,
          },
          {
            find: "nuqs",
            replacement: storybookNuqsEntry,
          },
          {
            find: "@/lib/providers",
            replacement: path.resolve(configDir, "../../app/lib/system/runtime/providers.ts"),
          },
          {
            find: "@/hooks/use-disabled-plugins",
            replacement: path.resolve(configDir, "../src/mocks/hooks/use-disabled-plugins.ts"),
          },
          {
            find: "@/hooks/use-integration-connections",
            replacement: path.resolve(
              configDir,
              "../src/mocks/hooks/use-integration-connections.ts"
            ),
          },
          {
            find: "@/hooks/use-plugin-configs",
            replacement: path.resolve(configDir, "../src/mocks/hooks/use-plugin-configs.ts"),
          },
          {
            find: "@/hooks/use-project-context",
            replacement: path.resolve(configDir, "../src/mocks/hooks/use-project-context.ts"),
          },
          {
            find: "@/hooks/use-project-integrations",
            replacement: path.resolve(configDir, "../src/mocks/hooks/use-project-integrations.ts"),
          },
          {
            find: "@/hooks/use-settings",
            replacement: path.resolve(configDir, "../src/mocks/hooks/use-settings.ts"),
          },
          {
            find: "@radarboard/storybook-preview",
            replacement: path.resolve(configDir, "./preview.tsx"),
          },
          {
            find: "@radarboard/storybook-scaffold",
            replacement: path.resolve(configDir, "../src/story-scaffold.tsx"),
          },
          {
            find: "@radarboard/hooks/use-credentials",
            replacement: path.resolve(configDir, "../src/mocks/hooks/use-credentials.ts"),
          },
          {
            find: "@radarboard/hooks/use-dashboard",
            replacement: path.resolve(configDir, "../src/mocks/hooks/use-dashboard.ts"),
          },
          {
            find: "@radarboard/hooks/use-mcp-servers",
            replacement: path.resolve(configDir, "../src/mocks/hooks/use-mcp-servers.ts"),
          },
          {
            find: "@radarboard/hooks/use-notification-preferences",
            replacement: path.resolve(
              configDir,
              "../src/mocks/hooks/use-notification-preferences.ts"
            ),
          },
          {
            find: /^@radarboard\/widget-analytics\//,
            replacement: `${path.resolve(configDir, "../../../widgets/analytics/src")}/`,
          },
          {
            find: "@radarboard/integration-sdk/init-stub",
            replacement: path.resolve(configDir, "../src/mocks/integrations-init.ts"),
          },
          {
            find: "@radarboard/integration-sdk/registry",
            replacement: path.resolve(configDir, "../src/mocks/integrations-registry.ts"),
          },
        ],
      },
      plugins: [
        storyWatcherPlugin(configDir),
        tsconfigPaths({
          projects: [
            path.resolve(configDir, "../tsconfig.json"),
            path.resolve(configDir, "../../app/tsconfig.json"),
          ],
        }),
      ],
    });
  },
});

export default config;
