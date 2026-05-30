import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getPort } from "get-port-please";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Resolves the absolute path to the Next.js standalone server entry point.
 *
 * In development: ../app/.next/standalone/apps/app/server.js
 * In production (bundled): resources/standalone/server.js
 */
function resolveServerPath() {
  // Bundled production path (Tauri resources directory)
  const bundledPath = join(process.env.TAURI_RESOURCE_DIR ?? "", "standalone", "server.js");
  if (existsSync(bundledPath)) return bundledPath;

  // Development/local path — resolve relative to this script (apps/desktop/scripts/)
  const desktopRoot = resolve(__dirname, "..");
  const devPath = resolve(
    desktopRoot,
    "..",
    "app",
    ".next",
    "standalone",
    "apps",
    "app",
    "server.js"
  );
  if (existsSync(devPath)) return devPath;

  throw new Error(`Next.js server not found. Checked: ${bundledPath}, ${devPath}`);
}

/**
 * Wait for the server to accept HTTP connections.
 * Polls every 200ms up to `timeoutMs`.
 */
async function waitForReady(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (res.ok || res.status < 500) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`);
}

/**
 * Starts the Next.js standalone server.
 *
 * @param {object} options
 * @param {number} [options.port] - The port to listen on. Defaults to a random free port.
 * @returns {{ port: number, process: ChildProcess, url: string, kill: () => void }}
 */
export async function startServer(options = {}) {
  const port = options.port ?? (await getPort({ host: "127.0.0.1" }));
  const serverPath = resolveServerPath();

  const env = {
    ...process.env,
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
    NODE_ENV: "production",
    NEXT_PUBLIC_APP_URL: `http://127.0.0.1:${port}`,
  };

  console.error(`[next-server] Starting standalone server: ${serverPath}`);
  console.error(`[next-server] Port: ${port}`);

  // stdout/stderr both go to stderr so they don't interfere with
  // the URL protocol on stdout (Rust reads the first stdout line).
  const child = spawn("node", [serverPath], {
    env,
    stdio: ["ignore", "pipe", "inherit"],
    windowsHide: true,
  });

  // Forward child stdout to stderr
  child.stdout.on("data", (chunk) => {
    process.stderr.write(chunk);
  });

  child.on("error", (err) => {
    console.error("[next-server] Failed to start server process:", err);
  });

  child.on("exit", (code) => {
    if (code !== 0) {
      console.error(`[next-server] Server process exited with code ${code}`);
    }
  });

  const url = `http://127.0.0.1:${port}`;

  // Wait for the server to actually accept connections before returning
  await waitForReady(url);
  console.error(`[next-server] Server ready at ${url}`);

  return {
    port,
    process: child,
    url,
    kill: () => {
      console.error("[next-server] Stopping server...");
      child.kill();
    },
  };
}

// When run directly (from Tauri), start the server and print the URL
// to stdout so the Rust host can read it.
if (process.argv[1]?.endsWith("next-server.mjs")) {
  const port = process.env.PORT ? Number(process.env.PORT) : undefined;
  startServer({ port })
    .then(({ url }) => {
      process.stdout.write(`${url}\n`);
    })
    .catch((err) => {
      console.error("[next-server] Critical failure:", err);
      process.exit(1);
    });
}
