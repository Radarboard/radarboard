import type { ChangelogState } from "../types";

export async function getChangelogStateRoute(
  getChangelogState: () => Promise<ChangelogState>
): Promise<{ ok: true } & ChangelogState> {
  return { ok: true, ...(await getChangelogState()) };
}

export async function syncChangelogRoute(
  syncChangelog: (input: { force: boolean }) => Promise<ChangelogState>,
  input: { force?: boolean }
): Promise<{ ok: true } & ChangelogState> {
  return { ok: true, ...(await syncChangelog({ force: input.force ?? false })) };
}

export async function importChangelogDependenciesRoute(
  importChangelogDependencies: (input: {
    projectSlug: string;
    platformId: string;
  }) => Promise<ChangelogState>,
  input: { projectSlug: string; platformId: string }
): Promise<{ ok: true } & ChangelogState> {
  return { ok: true, ...(await importChangelogDependencies(input)) };
}
