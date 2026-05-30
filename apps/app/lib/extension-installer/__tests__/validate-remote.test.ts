import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

import { validateRemoteExtension } from "../validate-remote";

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

function mockGitHubFile(files: Record<string, string | null>) {
  fetchMock.mockImplementation(async (url: string) => {
    for (const [path, content] of Object.entries(files)) {
      if (url.includes(path)) {
        if (content === null) return { ok: false, status: 404 };
        return { ok: true, text: async () => content };
      }
    }
    return { ok: false, status: 404 };
  });
}

const validWidgetPkg = JSON.stringify({
  name: "@radarboard/widget-stars",
  description: "GitHub stars widget",
  dependencies: { "@radarboard/widget-sdk": "workspace:*" },
  exports: { ".": "./src/index.ts" },
});

describe("validateRemoteExtension", () => {
  it("validates a correct widget extension", async () => {
    mockGitHubFile({
      "package.json": validWidgetPkg,
      "src/index.ts": 'export const StarsDescriptor = { id: "stars" }',
      "src/conformance.test.ts": "describe('conformance', () => {})",
    });

    const result = await validateRemoteExtension({ owner: "acme", repo: "widget-stars" });

    expect(result.valid).toBe(true);
    expect(result.category).toBe("widget");
    expect(result.id).toBe("stars");
    expect(result.name).toBe("@radarboard/widget-stars");
    expect(result.description).toBe("GitHub stars widget");
    expect(result.errors).toEqual([]);
  });

  it("returns error when package.json is missing", async () => {
    mockGitHubFile({ "package.json": null });

    const result = await validateRemoteExtension({ owner: "acme", repo: "repo" });

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/No package\.json/);
  });

  it("returns error when package.json is invalid JSON", async () => {
    mockGitHubFile({ "package.json": "not json{" });

    const result = await validateRemoteExtension({ owner: "acme", repo: "repo" });

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/not valid JSON/);
  });

  it("returns error when name field is missing", async () => {
    mockGitHubFile({ "package.json": JSON.stringify({ version: "1.0" }) });

    const result = await validateRemoteExtension({ owner: "acme", repo: "repo" });

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/missing.*name/i);
  });

  it("returns error for non-radarboard package name", async () => {
    mockGitHubFile({
      "package.json": JSON.stringify({ name: "my-cool-package" }),
    });

    const result = await validateRemoteExtension({ owner: "acme", repo: "repo" });

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/doesn't match/);
  });

  it("detects integration category", async () => {
    mockGitHubFile({
      "package.json": JSON.stringify({
        name: "@radarboard/integration-stripe",
        dependencies: { "@radarboard/integration-sdk": "workspace:*" },
        exports: { ".": "./src/index.ts" },
      }),
      "src/index.ts": "export const StripeDescriptor = {}",
    });

    const result = await validateRemoteExtension({ owner: "acme", repo: "repo" });

    expect(result.category).toBe("integration");
    expect(result.id).toBe("stripe");
  });

  it("detects plugin category", async () => {
    mockGitHubFile({
      "package.json": JSON.stringify({
        name: "@radarboard/plugin-notes",
        dependencies: { "@radarboard/plugin-sdk": "workspace:*" },
        exports: { ".": "./src/index.ts" },
      }),
      "src/index.ts": "export const NotesDescriptor = {}",
    });

    const result = await validateRemoteExtension({ owner: "acme", repo: "repo" });

    expect(result.category).toBe("plugin");
    expect(result.id).toBe("notes");
  });

  it("errors on missing exports map", async () => {
    mockGitHubFile({
      "package.json": JSON.stringify({
        name: "@radarboard/widget-stars",
        dependencies: { "@radarboard/widget-sdk": "workspace:*" },
      }),
    });

    const result = await validateRemoteExtension({ owner: "acme", repo: "repo" });

    expect(result.errors).toContainEqual(expect.stringMatching(/exports/));
  });

  it("errors on missing '.' export entry", async () => {
    mockGitHubFile({
      "package.json": JSON.stringify({
        name: "@radarboard/widget-stars",
        dependencies: { "@radarboard/widget-sdk": "workspace:*" },
        exports: { "./types": "./src/types.ts" },
      }),
    });

    const result = await validateRemoteExtension({ owner: "acme", repo: "repo" });

    expect(result.errors).toContainEqual(expect.stringMatching(/missing.*"\.".*entry/i));
  });

  it("errors on missing required SDK dependency", async () => {
    mockGitHubFile({
      "package.json": JSON.stringify({
        name: "@radarboard/widget-stars",
        dependencies: { "@radarboard/types": "workspace:*" },
        exports: { ".": "./src/index.ts" },
      }),
      "src/index.ts": "export const Descriptor = {}",
    });

    const result = await validateRemoteExtension({ owner: "acme", repo: "repo" });

    expect(result.errors).toContainEqual(expect.stringMatching(/widget-sdk/));
  });

  it("errors on cross-extension dependency", async () => {
    mockGitHubFile({
      "package.json": JSON.stringify({
        name: "@radarboard/widget-combo",
        dependencies: {
          "@radarboard/widget-sdk": "workspace:*",
          "@radarboard/widget-stars": "workspace:*",
        },
        exports: { ".": "./src/index.ts" },
      }),
      "src/index.ts": "export const Descriptor = {}",
    });

    const result = await validateRemoteExtension({ owner: "acme", repo: "repo" });

    expect(result.errors).toContainEqual(expect.stringMatching(/cross-extension/i));
  });

  it("warns on non-standard but non-forbidden dependencies", async () => {
    mockGitHubFile({
      "package.json": JSON.stringify({
        name: "@radarboard/widget-stars",
        dependencies: {
          "@radarboard/widget-sdk": "workspace:*",
          "@radarboard/unknown-pkg": "workspace:*",
        },
        exports: { ".": "./src/index.ts" },
      }),
      "src/index.ts": "export const Descriptor = {}",
    });

    const result = await validateRemoteExtension({ owner: "acme", repo: "repo" });

    expect(result.warnings).toContainEqual(expect.stringMatching(/unknown-pkg/));
    // Should be a warning, NOT an error
    expect(result.valid).toBe(true);
  });

  it("warns when entry file has no Descriptor export", async () => {
    mockGitHubFile({
      "package.json": validWidgetPkg,
      "src/index.ts": "export const data = 42;",
    });

    const result = await validateRemoteExtension({ owner: "acme", repo: "repo" });

    expect(result.warnings).toContainEqual(expect.stringMatching(/descriptor/i));
  });

  it("warns when no conformance test found", async () => {
    mockGitHubFile({
      "package.json": validWidgetPkg,
      "src/index.ts": "export const StarsDescriptor = {}",
    });

    const result = await validateRemoteExtension({ owner: "acme", repo: "repo" });

    expect(result.warnings).toContainEqual(expect.stringMatching(/conformance/i));
  });

  it("finds conformance test in __tests__ directory", async () => {
    mockGitHubFile({
      "package.json": validWidgetPkg,
      "src/index.ts": "export const StarsDescriptor = {}",
      "src/__tests__/conformance.test.ts": "describe('conformance', () => {})",
    });

    const result = await validateRemoteExtension({ owner: "acme", repo: "repo" });

    expect(result.warnings).not.toContainEqual(expect.stringMatching(/conformance/i));
  });
});
