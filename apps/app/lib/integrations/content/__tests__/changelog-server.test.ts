import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getRepositoryMock,
  getRecentReleasesMock,
  getPluginRepoMock,
  getCredentialRepoMock,
  getSettingsRepoMock,
} = vi.hoisted(() => ({
  getRepositoryMock: vi.fn(),
  getRecentReleasesMock: vi.fn(),
  getPluginRepoMock: vi.fn(),
  getCredentialRepoMock: vi.fn(),
  getSettingsRepoMock: vi.fn(),
}));

vi.mock("@radarboard/integration-github/client", () => ({
  getRepository: getRepositoryMock,
  getRecentReleases: getRecentReleasesMock,
}));

vi.mock("@/data/core/repository", () => ({
  getPluginRepo: getPluginRepoMock,
  getCredentialRepo: getCredentialRepoMock,
  getSettingsRepo: getSettingsRepoMock,
}));

vi.mock("@/config/projects", () => ({
  PROJECTS: [
    {
      id: "radarboard",
      slug: "radarboard",
      name: "Radarboard",
      color: "#111111",
      description: "Dashboard",
      platforms: [
        {
          id: "web",
          name: "Web",
          type: "web_app",
          integrations: {
            github: {
              owner: "acme",
              repo: "monorepo",
            },
          },
        },
      ],
    },
    {
      id: "docs",
      slug: "docs",
      name: "Docs",
      color: "#222222",
      description: "Docs",
      platforms: [
        {
          id: "site",
          name: "Site",
          type: "website",
          integrations: {},
        },
      ],
    },
  ],
}));

import { getChangelogState, importChangelogDependencies, syncChangelog } from "../changelog-server";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function base64Content(value: string) {
  return Buffer.from(value, "utf8").toString("base64");
}

function npmMetadata(packageName: string, version: string, repositoryUrl?: string) {
  return {
    name: packageName,
    repository: repositoryUrl ? { url: repositoryUrl } : undefined,
    homepage: repositoryUrl ? repositoryUrl.replace(/\.git$/i, "") : undefined,
    time: { [version]: "2026-03-20T10:00:00.000Z" },
    "dist-tags": { latest: version },
  };
}

function createPluginRepoStore() {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (_pluginId: string, key: string) => store.get(key) ?? null),
    set: vi.fn(async (_pluginId: string, key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (_pluginId: string, key: string) => {
      store.delete(key);
    }),
    list: vi.fn(async (_pluginId: string, prefix: string) =>
      Array.from(store.entries())
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, value]) => ({ key, value }))
    ),
    store,
  };
}

const MOCK_FETCH_ROUTES: Array<{ match: string; handler: () => Response }> = [
  {
    match: "/git/trees/",
    handler: () =>
      jsonResponse({
        tree: [
          { path: "package.json", type: "blob" },
          { path: "apps/app/package.json", type: "blob" },
          { path: "packages/ui/package.json", type: "blob" },
        ],
      }),
  },
  {
    match: "/contents/package.json?",
    handler: () =>
      jsonResponse({
        encoding: "base64",
        content: base64Content(
          JSON.stringify({ name: "root", dependencies: { "root-dep": "^1.0.0" } })
        ),
      }),
  },
  {
    match: "/contents/pnpm-workspace.yaml?",
    handler: () =>
      jsonResponse({
        encoding: "base64",
        content: base64Content('packages:\n  - "apps/*"\n  - "packages/*"\n'),
      }),
  },
  {
    match: "/contents/apps/app/package.json?",
    handler: () =>
      jsonResponse({
        encoding: "base64",
        content: base64Content(
          JSON.stringify({
            name: "@acme/web",
            dependencies: { react: "^19.0.0" },
            devDependencies: { vitest: "^4.0.0" },
          })
        ),
      }),
  },
  {
    match: "/contents/packages/ui/package.json?",
    handler: () =>
      jsonResponse({
        encoding: "base64",
        content: base64Content(
          JSON.stringify({
            name: "@acme/ui",
            dependencies: { react: "^19.0.0", lodash: "^4.17.0" },
          })
        ),
      }),
  },
  {
    match: "registry.npmjs.org/root-dep",
    handler: () => jsonResponse(npmMetadata("root-dep", "1.0.0")),
  },
  {
    match: "registry.npmjs.org/react",
    handler: () =>
      jsonResponse(npmMetadata("react", "19.2.4", "git+https://github.com/facebook/react.git")),
  },
  {
    match: "registry.npmjs.org/lodash",
    handler: () => jsonResponse(npmMetadata("lodash", "4.17.21")),
  },
  {
    match: "github.com/facebook/react/releases.atom",
    handler: () => new Response("<feed></feed>", { status: 200 }),
  },
];

async function createMockFetch(input: RequestInfo | URL): Promise<Response> {
  const url = String(input);
  const route = MOCK_FETCH_ROUTES.find((r) => url.includes(r.match));
  if (route) return route.handler();
  throw new Error(`Unhandled fetch: ${url}`);
}

describe("changelog-server", () => {
  let pluginRepo: ReturnType<typeof createPluginRepoStore>;

  beforeEach(() => {
    vi.restoreAllMocks();
    pluginRepo = createPluginRepoStore();
    getPluginRepoMock.mockReturnValue(pluginRepo);
    getCredentialRepoMock.mockReturnValue({
      getCredential: vi.fn().mockResolvedValue(null),
    });
    getSettingsRepoMock.mockReturnValue({
      getProjectIntegrations: vi.fn().mockResolvedValue({}),
    });
    getRepositoryMock.mockResolvedValue({ default_branch: "main" });
    getRecentReleasesMock.mockResolvedValue([]);
    vi.stubGlobal("fetch", vi.fn(createMockFetch));
  });

  it("imports direct dependencies from root and workspace manifests and ignores devDependencies", async () => {
    const state = await importChangelogDependencies({
      projectSlug: "radarboard",
      platformId: "web",
    });

    expect(state.watches.map((watch) => watch.packageName)).toEqual([
      "lodash",
      "react",
      "root-dep",
    ]);
    expect(state.watches.every((watch) => watch.status === "active")).toBe(true);
    expect(state.watches.some((watch) => watch.packageName === "vitest")).toBe(false);
  });

  it("prefers GitHub releases and merges multiple watches for the same package", async () => {
    await pluginRepo.set(
      "changelog",
      "changelog:watches",
      JSON.stringify([
        {
          id: "radarboard:web:react",
          projectSlug: "radarboard",
          projectName: "Radarboard",
          platformId: "web",
          platformName: "Web",
          packageName: "react",
          source: "manual",
          status: "active",
          includePrereleases: false,
          createdAt: "2026-03-20T00:00:00.000Z",
          lastImportedAt: null,
          updatedAt: "2026-03-20T00:00:00.000Z",
        },
        {
          id: "docs:site:react",
          projectSlug: "docs",
          projectName: "Docs",
          platformId: "site",
          platformName: "Site",
          packageName: "react",
          source: "manual",
          status: "active",
          includePrereleases: false,
          createdAt: "2026-03-20T00:00:00.000Z",
          lastImportedAt: null,
          updatedAt: "2026-03-20T00:00:00.000Z",
        },
      ])
    );

    getRecentReleasesMock.mockResolvedValue([
      {
        tag_name: "v19.2.4",
        name: "React 19.2.4",
        body: "Important fixes",
        published_at: "2026-03-20T10:00:00.000Z",
        html_url: "https://github.com/facebook/react/releases/tag/v19.2.4",
        prerelease: false,
        draft: false,
      },
    ]);

    const state = await syncChangelog({ force: true });
    const entry = state.entries[0];

    expect(entry?.sourceType).toBe("github_release");
    expect(entry?.notesQuality).toBe("full");
    expect(entry?.description).toContain("Important fixes");
    expect(entry?.body).toBe("Important fixes");
    expect(entry?.bodyFormat).toBe("markdown");
    expect(entry?.watchIds).toHaveLength(2);
  });

  it("falls back to npm publish metadata when no usable GitHub release exists", async () => {
    await pluginRepo.set(
      "changelog",
      "changelog:watches",
      JSON.stringify([
        {
          id: "radarboard:web:lodash",
          projectSlug: "radarboard",
          projectName: "Radarboard",
          platformId: "web",
          platformName: "Web",
          packageName: "lodash",
          source: "manual",
          status: "active",
          includePrereleases: false,
          createdAt: "2026-03-20T00:00:00.000Z",
          lastImportedAt: null,
          updatedAt: "2026-03-20T00:00:00.000Z",
        },
      ])
    );

    const state = await syncChangelog({ force: true });
    const entry = state.entries[0];

    expect(entry?.sourceType).toBe("npm_publish");
    expect(entry?.notesQuality).toBe("minimal");
    expect(entry?.releaseUrl).toContain("npmjs.com/package");
  });

  it("creates prerelease entries only when a watch opts in", async () => {
    await pluginRepo.set(
      "changelog",
      "changelog:watches",
      JSON.stringify([
        {
          id: "radarboard:web:react-pr",
          projectSlug: "radarboard",
          projectName: "Radarboard",
          platformId: "web",
          platformName: "Web",
          packageName: "react-pr",
          source: "manual",
          status: "active",
          includePrereleases: true,
          createdAt: "2026-03-20T00:00:00.000Z",
          lastImportedAt: null,
          updatedAt: "2026-03-20T00:00:00.000Z",
        },
      ])
    );
    await pluginRepo.set(
      "changelog",
      "changelog:tracked-packages",
      JSON.stringify([
        {
          packageName: "react-pr",
          npmUrl: "https://www.npmjs.com/package/react-pr",
          homepageUrl: "https://react.dev",
          repositoryUrl: "git+https://github.com/facebook/react.git",
          releaseSource: "github_release",
          notesQuality: "full",
          githubRepo: { owner: "facebook", repo: "react" },
          lastStableVersion: "19.2.4",
          lastPrereleaseVersion: null,
          lastPublishedAt: "2026-03-20T10:00:00.000Z",
          lastSyncedAt: "2026-03-20T10:00:00.000Z",
          createdAt: "2026-03-20T10:00:00.000Z",
          updatedAt: "2026-03-20T10:00:00.000Z",
        },
      ])
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("registry.npmjs.org/react-pr")) {
          return jsonResponse({
            ...npmMetadata("react-pr", "19.2.4", "git+https://github.com/facebook/react.git"),
            "dist-tags": { latest: "19.2.4", next: "19.3.0-beta.1" },
            time: {
              "19.2.4": "2026-03-20T10:00:00.000Z",
              "19.3.0-beta.1": "2026-03-21T10:00:00.000Z",
            },
          });
        }
        if (url.includes("github.com/facebook/react/releases.atom")) {
          return new Response("<feed></feed>", { status: 200 });
        }
        throw new Error(`Unhandled fetch: ${url}`);
      })
    );

    const state = await syncChangelog({ force: true });
    expect(
      state.entries.some((entry) => entry.isPrerelease && entry.version === "19.3.0-beta.1")
    ).toBe(true);
  });

  it("returns current stored state", async () => {
    await pluginRepo.set("changelog", "changelog:watches", JSON.stringify([]));
    const state = await getChangelogState();
    expect(state.targets).toHaveLength(2);
    expect(state.entries).toEqual([]);
  });
});
