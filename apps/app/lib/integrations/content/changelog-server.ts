interface ChangelogUnavailableState {
  entries: [];
  watches: [];
  importTargets: [];
  syncState: {
    status: "idle";
    lastSyncedAt: null;
    nextSyncAt: null;
    error: null;
  };
}

function createUnavailableState(): ChangelogUnavailableState {
  return {
    entries: [],
    watches: [],
    importTargets: [],
    syncState: {
      status: "idle",
      lastSyncedAt: null,
      nextSyncAt: null,
      error: null,
    },
  };
}

export async function getChangelogState(): Promise<ChangelogUnavailableState> {
  return createUnavailableState();
}

export async function syncChangelog(): Promise<ChangelogUnavailableState> {
  return createUnavailableState();
}

export async function importChangelogDependencies(): Promise<ChangelogUnavailableState> {
  return createUnavailableState();
}
