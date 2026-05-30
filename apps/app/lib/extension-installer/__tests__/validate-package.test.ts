import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GitHubRepo } from "../parse-github-url";

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import after mock setup
const { validateExtensionPackage, validateGitHubExtension } = await import("../validate-package");

const REPO: GitHubRepo = { owner: "test-user", repo: "test-ext" };

function mockFile(path: string, content: string | null) {
  mockFetch.mockImplementation((url: string) => {
    if (url.includes(path)) {
      if (content === null) {
        return Promise.resolve({ ok: false, text: () => Promise.resolve("") });
      }
      return Promise.resolve({ ok: true, text: () => Promise.resolve(content) });
    }
    // Default: not found
    return Promise.resolve({ ok: false, text: () => Promise.resolve("") });
  });
}

function mockFiles(files: Record<string, string>) {
  mockFetch.mockImplementation((url: string) => {
    for (const [path, content] of Object.entries(files)) {
      if (url.includes(path)) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(content) });
      }
    }
    return Promise.resolve({ ok: false, text: () => Promise.resolve("") });
  });
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe("validateExtensionPackage", () => {
  it("returns isPackage: false when no manifest exists", async () => {
    mockFile("radarboard-extension.json", null);
    const result = await validateExtensionPackage(REPO);
    expect(result.isPackage).toBe(false);
    expect(result.valid).toBe(false);
    expect(result.manifest).toBeNull();
  });

  it("returns error for invalid JSON manifest", async () => {
    mockFile("radarboard-extension.json", "{ invalid json }");
    const result = await validateExtensionPackage(REPO);
    expect(result.isPackage).toBe(true);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("radarboard-extension.json is not valid JSON");
  });

  it("validates a manifest with missing name", async () => {
    mockFiles({
      "radarboard-extension.json": JSON.stringify({
        extensions: [{ type: "widget", path: "widgets/test", name: "@radarboard/widget-test" }],
      }),
      "widgets/test/package.json": JSON.stringify({
        name: "@radarboard/widget-test",
        exports: { ".": "./index.ts" },
        dependencies: { "@radarboard/widget-sdk": "workspace:*" },
      }),
    });

    const result = await validateExtensionPackage(REPO);
    expect(result.isPackage).toBe(true);
    expect(result.errors).toContain("Manifest missing 'name' field");
  });

  it("validates a manifest with no extensions", async () => {
    mockFiles({
      "radarboard-extension.json": JSON.stringify({
        name: "Test Package",
        extensions: [],
      }),
    });

    const result = await validateExtensionPackage(REPO);
    expect(result.errors).toContain("Manifest has no extensions declared");
  });

  it("validates a valid multi-extension package", async () => {
    mockFiles({
      "radarboard-extension.json": JSON.stringify({
        name: "Notion Extension Package",
        extensions: [
          {
            type: "integration",
            path: "integrations/notion",
            name: "@radarboard/integration-notion",
          },
          { type: "widget", path: "widgets/notion", name: "@radarboard/widget-notion" },
        ],
      }),
      "integrations/notion/package.json": JSON.stringify({
        name: "@radarboard/integration-notion",
        exports: { ".": "./src/index.ts" },
        dependencies: { "@radarboard/integration-sdk": "workspace:*" },
      }),
      "widgets/notion/package.json": JSON.stringify({
        name: "@radarboard/widget-notion",
        exports: { ".": "./index.ts" },
        dependencies: { "@radarboard/widget-sdk": "workspace:*" },
      }),
    });

    const result = await validateExtensionPackage(REPO);
    expect(result.isPackage).toBe(true);
    expect(result.valid).toBe(true);
    expect(result.manifest?.name).toBe("Notion Extension Package");
    expect(result.extensions).toHaveLength(2);
    expect(result.extensions.every((e) => e.valid)).toBe(true);
  });

  it("catches package name mismatch", async () => {
    mockFiles({
      "radarboard-extension.json": JSON.stringify({
        name: "Test",
        extensions: [{ type: "widget", path: "widgets/test", name: "@radarboard/widget-test" }],
      }),
      "widgets/test/package.json": JSON.stringify({
        name: "@radarboard/widget-wrong-name",
        exports: { ".": "./index.ts" },
        dependencies: { "@radarboard/widget-sdk": "workspace:*" },
      }),
    });

    const result = await validateExtensionPackage(REPO);
    const widgetResult = result.extensions[0];
    expect(widgetResult?.valid).toBe(false);
    expect(widgetResult?.errors.some((e) => e.includes("name mismatch"))).toBe(true);
  });

  it("catches missing SDK dependency", async () => {
    mockFiles({
      "radarboard-extension.json": JSON.stringify({
        name: "Test",
        extensions: [{ type: "plugin", path: "plugins/test", name: "@radarboard/plugin-test" }],
      }),
      "plugins/test/package.json": JSON.stringify({
        name: "@radarboard/plugin-test",
        exports: { ".": "./src/index.ts" },
        dependencies: {},
      }),
    });

    const result = await validateExtensionPackage(REPO);
    const pluginResult = result.extensions[0];
    expect(pluginResult?.errors.some((e) => e.includes("@radarboard/plugin-sdk"))).toBe(true);
  });

  it("warns about non-standard dependencies", async () => {
    mockFiles({
      "radarboard-extension.json": JSON.stringify({
        name: "Test",
        extensions: [{ type: "widget", path: "widgets/test", name: "@radarboard/widget-test" }],
      }),
      "widgets/test/package.json": JSON.stringify({
        name: "@radarboard/widget-test",
        exports: { ".": "./index.ts" },
        dependencies: {
          "@radarboard/widget-sdk": "workspace:*",
          "@radarboard/some-unknown-pkg": "workspace:*",
        },
      }),
    });

    const result = await validateExtensionPackage(REPO);
    const widgetResult = result.extensions[0];
    expect(widgetResult?.warnings.some((w) => w.includes("not in standard allowlist"))).toBe(true);
  });
});

describe("validateGitHubExtension", () => {
  it("returns package kind for repos with manifest", async () => {
    mockFiles({
      "radarboard-extension.json": JSON.stringify({
        name: "Test",
        extensions: [{ type: "widget", path: "widgets/test", name: "@radarboard/widget-test" }],
      }),
      "widgets/test/package.json": JSON.stringify({
        name: "@radarboard/widget-test",
        exports: { ".": "./index.ts" },
        dependencies: { "@radarboard/widget-sdk": "workspace:*" },
      }),
    });

    const result = await validateGitHubExtension(REPO);
    expect(result.kind).toBe("package");
  });

  it("falls back to single kind for repos without manifest", async () => {
    mockFiles({
      "package.json": JSON.stringify({
        name: "@radarboard/widget-analytics",
        exports: { ".": "./index.ts" },
        dependencies: { "@radarboard/widget-sdk": "workspace:*" },
      }),
    });

    const result = await validateGitHubExtension(REPO);
    expect(result.kind).toBe("single");
  });
});
