/**
 * Thin app-shell wrapper for GitHub stars backfill.
 *
 * The implementation lives in @radarboard/integration-github/stars.
 */

import { backfillGitHubStarsHistory } from "@radarboard/integration-github/stars";
import { getSettingsRepo } from "../data/core/repository";
import { buildDataSourceContext } from "../lib/assistant/core/data-source-context";

function parseProjectArg(): string | null {
  const match = process.argv.find((arg) => arg.startsWith("--project="));
  if (!match) return null;
  const [, value = ""] = match.split("=");
  return value.trim().length > 0 ? value.trim() : null;
}

function parseRepoArgs(): Array<{ owner: string; repo: string }> {
  return process.argv
    .filter((arg) => arg.startsWith("--repo="))
    .flatMap((arg) => {
      const [, value = ""] = arg.split("=");
      const [owner = "", repo = ""] = value.split("/");
      const normalizedOwner = owner.trim();
      const normalizedRepo = repo.trim();
      if (!normalizedOwner || !normalizedRepo) return [];
      return [{ owner: normalizedOwner, repo: normalizedRepo }];
    });
}

function resolveSelectedReposFromWidgetConfig(
  config: unknown
): Array<{ owner: string; repo: string }> {
  if (!config || typeof config !== "object") return [];

  const selectedRepos = (config as { selectedRepos?: unknown }).selectedRepos;
  if (!Array.isArray(selectedRepos)) return [];

  return selectedRepos.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const owner = "owner" in value && typeof value.owner === "string" ? value.owner.trim() : "";
    const repo = "repo" in value && typeof value.repo === "string" ? value.repo.trim() : "";
    if (!owner || !repo) return [];
    return [{ owner, repo }];
  });
}

async function main() {
  const projectSlug = parseProjectArg();
  const forcedRepos = parseRepoArgs();
  const startedAt = Date.now();

  console.log(
    `[github-stars-backfill] starting ${projectSlug ? `for ${projectSlug}` : "for all configured repos"}`
  );

  const ctx = buildDataSourceContext();
  const widgetLayout = await getSettingsRepo()
    .getWidgetLayout()
    .catch(() => null);
  const selectedRepos = [
    ...resolveSelectedReposFromWidgetConfig(widgetLayout?.configs?.["github-stars"]),
    ...forcedRepos,
  ];

  const result = await backfillGitHubStarsHistory({
    ctx,
    projectSlug,
    selectedRepos,
  });

  const synced = result.repos.filter((repo) => repo.backfillStatus === "complete").length;
  const pending = result.repos.filter((repo) => repo.backfillStatus !== "complete").length;

  console.log(
    `[github-stars-backfill] completed in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`
  );
  console.log(
    `[github-stars-backfill] repos=${result.repos.length} synced=${synced} pending=${pending}`
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[github-stars-backfill] failed: ${message}`);
  process.exit(1);
});
