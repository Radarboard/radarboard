/* biome-ignore-all lint/suspicious/noConsole: dev server logging is intentional for DX feedback. */
/**
 * Vite plugin that watches source story directories and regenerates proxy
 * stories in `.generated/` when they change.
 *
 * Unlike a background `--watch` process, this runs inside Vite's dev server:
 * - Uses Vite's built-in chokidar watcher (no orphan processes)
 * - Explicitly invalidates Vite's module graph after regeneration
 * - Sends full-reload via Vite's WebSocket for instant updates
 * - Cleans up automatically when the dev server stops
 */
import { exec } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { Plugin, ViteDevServer } from "vite";

function discoverSourceRoots(monorepoRoot: string): string[] {
  return [
    path.resolve(monorepoRoot, "packages/ui/src"),
    path.resolve(monorepoRoot, "packages/widget-engine/src"),
    path.resolve(monorepoRoot, "apps/app/components"),
    ...fs
      .readdirSync(path.resolve(monorepoRoot, "widgets"), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => path.resolve(monorepoRoot, "widgets", d.name, "src"))
      .filter((p) => fs.existsSync(p)),
  ];
}

function handleGeneratorOutput(
  error: Error | null,
  stdout: string,
  server: ViteDevServer | null
): void {
  if (error) {
    console.error("[story-watcher] regeneration failed:", error.message);
    return;
  }

  try {
    const result = JSON.parse(stdout);
    const changed = result.proxyCount > 0 || result.createdCount > 0;
    if (changed) {
      console.log(
        `[story-watcher] regenerated (${result.proxyCount} proxies, ${result.createdCount} scaffolds)`
      );
    }
  } catch {
    if (stdout.trim()) console.log("[story-watcher]", stdout.trim());
  }

  if (server) {
    server.ws.send({ type: "full-reload" });
  }
}

export function storyWatcherPlugin(configDir: string): Plugin {
  const monorepoRoot = path.resolve(configDir, "../../..");
  const storybookRoot = path.resolve(configDir, "..");
  const sourceRoots = discoverSourceRoots(monorepoRoot);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let server: ViteDevServer | null = null;

  function regenerateAndReload(): void {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      exec("tsx scripts/generate-stories.ts", { cwd: storybookRoot }, (error, stdout) => {
        handleGeneratorOutput(error, stdout, server);
      });
    }, 150);
  }

  function isSourceStoryFile(filePath: string): boolean {
    if (!filePath.endsWith(".stories.tsx")) return false;
    return sourceRoots.some((root) => filePath.startsWith(root));
  }

  return {
    name: "radarboard-story-watcher",
    configureServer(viteServer) {
      server = viteServer;

      for (const root of sourceRoots) {
        viteServer.watcher.add(root);
      }

      for (const event of ["change", "add", "unlink"] as const) {
        viteServer.watcher.on(event, (filePath) => {
          if (isSourceStoryFile(filePath)) regenerateAndReload();
        });
      }

      console.log("[story-watcher] watching source story directories for changes");
    },
  };
}
