import { execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT_PATH = join(__dirname, "..", "scaffold-extension-repo.ts");
const OUT_DIR = "/tmp";
const REPO_DIR = join(OUT_DIR, "radarboard-test-ext");

function run(args: string): string {
  return execSync(`npx tsx ${SCRIPT_PATH} ${args}`, {
    encoding: "utf8",
    cwd: join(__dirname, "../.."),
  });
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

afterEach(() => {
  if (existsSync(REPO_DIR)) {
    rmSync(REPO_DIR, { recursive: true, force: true });
  }
});

describe("scaffold-extension-repo", () => {
  it("scaffolds a repo with all three extension types", () => {
    const output = run("test-ext --integration --plugin --widget --out /tmp");

    // Script ran successfully (execSync throws on non-zero exit)
    expect(output).toContain("radarboard-test-ext");

    // Directory was created
    expect(existsSync(REPO_DIR)).toBe(true);

    // radarboard-extension.json has 3 extensions
    const manifest = readJson(join(REPO_DIR, "radarboard-extension.json")) as {
      extensions: Array<{ type: string; name: string }>;
    };
    expect(manifest.extensions).toHaveLength(3);
    expect(manifest.extensions.map((e) => e.type)).toEqual([
      "integration",
      "plugin",
      "widget",
    ]);

    // Integration package.json
    const integrationPkg = readJson(
      join(REPO_DIR, "integrations", "test-ext", "package.json")
    ) as { name: string; dependencies: Record<string, string> };
    expect(integrationPkg.name).toBe("@radarboard/integration-test-ext");
    expect(integrationPkg.dependencies).toHaveProperty(
      "@radarboard/integration-sdk"
    );

    // Plugin package.json
    const pluginPkg = readJson(
      join(REPO_DIR, "plugins", "test-ext", "package.json")
    ) as { name: string; dependencies: Record<string, string> };
    expect(pluginPkg.name).toBe("@radarboard/plugin-test-ext");
    expect(pluginPkg.dependencies).toHaveProperty("@radarboard/plugin-sdk");

    // Widget package.json
    const widgetPkg = readJson(
      join(REPO_DIR, "widgets", "test-ext", "package.json")
    ) as { name: string; dependencies: Record<string, string> };
    expect(widgetPkg.name).toBe("@radarboard/widget-test-ext");
    expect(widgetPkg.dependencies).toHaveProperty("@radarboard/widget-sdk");

    // Widget index.ts contains WidgetDescriptor
    const widgetIndex = readFileSync(
      join(REPO_DIR, "widgets", "test-ext", "index.ts"),
      "utf8"
    );
    expect(widgetIndex).toContain("WidgetDescriptor");
  });

  it("scaffolds only a widget when only --widget is passed", () => {
    run("test-ext --widget --out /tmp");

    expect(existsSync(REPO_DIR)).toBe(true);

    // Only widget directory exists
    expect(existsSync(join(REPO_DIR, "widgets", "test-ext"))).toBe(true);
    expect(existsSync(join(REPO_DIR, "integrations"))).toBe(false);
    expect(existsSync(join(REPO_DIR, "plugins"))).toBe(false);

    // Manifest has only 1 extension
    const manifest = readJson(join(REPO_DIR, "radarboard-extension.json")) as {
      extensions: Array<{ type: string }>;
    };
    expect(manifest.extensions).toHaveLength(1);
    expect(manifest.extensions[0].type).toBe("widget");
  });
});
