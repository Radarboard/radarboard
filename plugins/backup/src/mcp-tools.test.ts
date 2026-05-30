import { createMockPluginAPI } from "@radarboard/plugin-sdk/testing";
import type { PluginAPI } from "@radarboard/plugin-sdk/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { backupMcpTools } from "./mcp-tools";
import type { ExportResult } from "./types";

function findTool(name: string) {
  const tool = backupMcpTools.find((entry) => entry.name === name);
  if (!tool) throw new Error(`Tool "${name}" not found`);
  return tool;
}

describe("Backup MCP Tools", () => {
  let api: PluginAPI;

  beforeEach(() => {
    api = createMockPluginAPI();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-27T00:00:00.000Z"));
  });

  it("creates an export link and stores it in recent history", async () => {
    const exportTool = findTool("export_data");
    const listTool = findTool("list_exports");

    const result = (await exportTool.execute(
      { source: "github", format: "csv", range: "7d", project_slug: "radarboard" },
      api
    )) as {
      filename: string;
      format: "csv" | "json";
      downloadUrl: string;
      message: string;
    };

    expect(result).toMatchObject({
      filename: "github-7d-2026-03-27.csv",
      format: "csv",
      downloadUrl: "/api/backup/export?source=github&format=csv&range=7d&project=radarboard",
    });
    expect(result.message).toContain("Download github-7d-2026-03-27.csv");

    const history = (await listTool.execute({ limit: 10 }, api)) as {
      exports: ExportResult[];
      total: number;
    };

    expect(history.total).toBe(1);
    expect(history.exports[0]).toMatchObject({
      filename: "github-7d-2026-03-27.csv",
      format: "csv",
    });
  });

  it("rejects unknown sources without adding export history", async () => {
    const exportTool = findTool("export_data");
    const listTool = findTool("list_exports");

    const result = (await exportTool.execute(
      { source: "unknown", format: "json", range: "30d" },
      api
    )) as { error: string };

    expect(result.error).toContain("Unknown source: unknown");

    const history = (await listTool.execute({ limit: 10 }, api)) as {
      exports: ExportResult[];
      total: number;
    };

    expect(history.total).toBe(0);
    expect(history.exports).toEqual([]);
  });
});
