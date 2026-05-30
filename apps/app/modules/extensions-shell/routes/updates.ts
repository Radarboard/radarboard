/* biome-ignore-all lint/style/useNamingConvention: GitHub API request headers intentionally use protocol casing. */
import { createLogger } from "@radarboard/logger/logger";
import { NextResponse } from "next/server";
import {
  getAllInstalledExtensions,
  type InstalledExtensionRecord,
} from "@/db/sqlite-installed-extensions";
import { errorJson } from "@/lib/api";

const log = createLogger("api/extensions/updates");

interface UpdateCheckResult {
  id: string;
  githubUrl: string;
  hasUpdate: boolean;
  currentSha: string | null;
  latestSha: string | null;
  error?: string;
}

async function fetchLatestCommitSha(
  githubUrl: string
): Promise<{ sha: string | null; error?: string }> {
  const match = githubUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return { sha: null, error: "Invalid GitHub URL" };

  const [, owner, repo] = match;

  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`,
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Radarboard",
        },
        next: { revalidate: 600 },
      }
    );

    if (!response.ok) {
      return { sha: null, error: `GitHub API ${response.status}` };
    }

    const commits = (await response.json()) as Array<{ sha: string }>;
    return { sha: commits[0]?.sha ?? null };
  } catch (err) {
    return { sha: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function handleGetExtensionUpdates() {
  try {
    const installed = await getAllInstalledExtensions();

    if (installed.length === 0) {
      return NextResponse.json({ updates: [] });
    }

    const results: UpdateCheckResult[] = await Promise.all(
      installed.map(async (ext: InstalledExtensionRecord): Promise<UpdateCheckResult> => {
        const { sha: latestSha, error } = await fetchLatestCommitSha(ext.githubUrl);

        const hasUpdate =
          latestSha !== null && ext.commitSha !== null && latestSha !== ext.commitSha;

        return {
          id: ext.id,
          githubUrl: ext.githubUrl,
          hasUpdate,
          currentSha: ext.commitSha,
          latestSha,
          error,
        };
      })
    );

    return NextResponse.json({ updates: results });
  } catch (err) {
    log.error("Failed to check extension updates", { error: err });
    return errorJson(500, err instanceof Error ? err.message : "Failed to check updates");
  }
}
