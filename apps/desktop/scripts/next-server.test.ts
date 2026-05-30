import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const existsSyncMock = vi.fn();
const getPortMock = vi.fn();
const spawnMock = vi.fn();

vi.mock("node:fs", () => ({
  existsSync: (...args: Parameters<typeof existsSyncMock>) => existsSyncMock(...args),
}));

vi.mock("get-port-please", () => ({
  getPort: (...args: Parameters<typeof getPortMock>) => getPortMock(...args),
}));

vi.mock("node:child_process", () => ({
  spawn: (...args: Parameters<typeof spawnMock>) => spawnMock(...args),
}));

function createChildProcess() {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  return {
    stdout: {
      on: vi.fn(),
    },
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      const current = listeners.get(event) ?? [];
      current.push(handler);
      listeners.set(event, current);
    }),
    kill: vi.fn(),
    __emit(event: string, ...args: unknown[]) {
      for (const handler of listeners.get(event) ?? []) {
        handler(...args);
      }
    },
  };
}

describe("desktop next-server sidecar", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    globalThis.__RADARBOARD_ALLOW_CONSOLE__ = true;
    delete process.env.TAURI_RESOURCE_DIR;
    getPortMock.mockResolvedValue(4311);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("ok", { status: 200 }))
    );
  });

  afterAll(() => {
    globalThis.__RADARBOARD_ALLOW_CONSOLE__ = false;
  });

  it("starts the bundled standalone server when Tauri resources are available", async () => {
    process.env.TAURI_RESOURCE_DIR = "/bundle";
    existsSyncMock.mockImplementation(
      (target: string) => target === "/bundle/standalone/server.js"
    );
    const child = createChildProcess();
    spawnMock.mockReturnValue(child);

    const { startServer } = await import("./next-server.mjs");
    const result = await startServer({});

    expect(getPortMock).toHaveBeenCalled();
    expect(spawnMock).toHaveBeenCalledWith(
      "node",
      ["/bundle/standalone/server.js"],
      expect.objectContaining({
        env: expect.objectContaining({
          PORT: "4311",
          HOSTNAME: "127.0.0.1",
          NEXT_PUBLIC_APP_URL: "http://127.0.0.1:4311",
        }),
      })
    );
    expect(result.url).toBe("http://127.0.0.1:4311");
    result.kill();
    expect(child.kill).toHaveBeenCalled();
  });

  it("falls back to the local standalone server path during development", async () => {
    existsSyncMock.mockImplementation((target: string) =>
      target.endsWith("/apps/app/.next/standalone/apps/app/server.js")
    );
    const child = createChildProcess();
    spawnMock.mockReturnValue(child);

    const { startServer } = await import("./next-server.mjs");
    const result = await startServer({ port: 4822 });

    expect(spawnMock).toHaveBeenCalledWith(
      "node",
      [expect.stringMatching(/apps\/app\/\.next\/standalone\/apps\/app\/server\.js$/)],
      expect.objectContaining({
        env: expect.objectContaining({
          PORT: "4822",
        }),
      })
    );
    expect(result.port).toBe(4822);
  });
});
