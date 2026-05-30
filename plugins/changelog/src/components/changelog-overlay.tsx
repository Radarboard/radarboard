"use client";

import { ThreePaneWorkspace } from "@radarboard/plugin-sdk/components/three-pane-workspace";
import { setPluginSelection } from "@radarboard/plugin-sdk/store";
import type { PluginRenderProps } from "@radarboard/plugin-sdk/types";
import { useDelayedMarkRead } from "@radarboard/plugin-sdk/use-delayed-mark-read";
import { usePluginSearchParam } from "@radarboard/plugin-sdk/use-plugin-search-param";
import { SkeletonShimmer } from "@radarboard/ui/skeleton-shimmer";
import { useEffect, useMemo, useState } from "react";
import type { PackageWatch } from "../types";
import { useChangelog } from "../use-changelog";
import { ChangelogActionsDialog } from "./changelog-overlay/changelog-actions-dialog";
import { ChangelogDetail } from "./changelog-overlay/changelog-detail";
import { ChangelogList } from "./changelog-overlay/changelog-list";
import { ChangelogManageDialog } from "./changelog-overlay/changelog-manage-dialog";
import { ChangelogSidebar } from "./changelog-overlay/changelog-sidebar";
import { CHANGELOG_ENTRY_QUERY_PARAM, MARK_READ_DELAY_MS } from "./constants";
import type { ProjectSummary, ReadTab, ScopeKey, SummaryStats } from "./types";
import { getFilteredEntries, getProjectSummaries } from "./utils";

export function ChangelogOverlay({ api }: PluginRenderProps) {
  const {
    targets,
    watches,
    trackedPackages,
    entries,
    entryMeta,
    syncState,
    loaded,
    error,
    isSyncing,
    sync,
    importDependencies,
    addManualWatch,
    setWatchStatus,
    togglePrereleases,
    removeWatch,
    markRead,
    markUnread,
    archiveEntry,
    unarchiveEntry,
    markAllRead,
  } = useChangelog(api);

  const [overlayUi, setOverlayUi] = useState({
    actionsOpen: false,
    manageOpen: false,
    manageSearch: "",
    readTab: "inbox" as ReadTab,
    scopeKey: "all" as ScopeKey,
    search: "",
    selectedEntryId: null as string | null,
  });
  const { actionsOpen, manageOpen, manageSearch, readTab, scopeKey, search, selectedEntryId } =
    overlayUi;
  const urlEntryId = usePluginSearchParam(api, "entryId", "changelog");
  const urlEntry = urlEntryId ? (entries.find((entry) => entry.id === urlEntryId) ?? null) : null;
  const effectiveScopeKey = urlEntryId ? "all" : scopeKey;
  const effectiveSearch = urlEntryId ? "" : search;
  const effectiveReadTab = urlEntry && entryMeta[urlEntry.id]?.archivedAt ? "archived" : readTab;
  const effectiveSelectedEntryId = urlEntryId ?? selectedEntryId;

  const trackedByName = useMemo(
    () => new Map(trackedPackages.map((item) => [item.packageName, item])),
    [trackedPackages]
  );
  const watchById = useMemo(() => new Map(watches.map((watch) => [watch.id, watch])), [watches]);
  const projectMetaBySlug = useMemo(
    () =>
      new Map(
        targets.map((target) => [
          target.projectSlug,
          { name: target.projectName, color: target.projectColor },
        ])
      ),
    [targets]
  );

  const projectSummaries = useMemo<ProjectSummary[]>(
    () => getProjectSummaries(targets, watches, entries),
    [targets, watches, entries]
  );

  const filteredEntries = useMemo(
    () =>
      getFilteredEntries(
        entries,
        entryMeta as Record<string, { readAt?: string; archivedAt?: string }>,
        effectiveReadTab,
        effectiveScopeKey,
        effectiveSearch
      ),
    [effectiveReadTab, effectiveScopeKey, effectiveSearch, entries, entryMeta]
  );
  const selectedEntry =
    filteredEntries.find((entry) => entry.id === effectiveSelectedEntryId) ??
    filteredEntries[0] ??
    null;
  const selectedEntryPackage = selectedEntry
    ? (trackedByName.get(selectedEntry.packageName) ?? null)
    : null;
  const selectedEntryWatches = selectedEntry
    ? selectedEntry.watchIds
        .map((watchId) => watchById.get(watchId))
        .filter((watch): watch is PackageWatch => Boolean(watch))
    : [];
  const selectedEntryIsRead = selectedEntry ? Boolean(entryMeta[selectedEntry.id]?.readAt) : false;
  const selectedEntryIsArchived = selectedEntry
    ? Boolean(entryMeta[selectedEntry.id]?.archivedAt)
    : false;

  // Sync selected entry into URL query string and plugin store (mirrors rss-reader)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const currentValue = params.get(CHANGELOG_ENTRY_QUERY_PARAM);
    const nextValue = selectedEntry?.id ?? null;
    if (currentValue === nextValue) return;

    if (nextValue) {
      params.set(CHANGELOG_ENTRY_QUERY_PARAM, nextValue);
    } else {
      params.delete(CHANGELOG_ENTRY_QUERY_PARAM);
    }

    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;
    window.history.replaceState(window.history.state, "", nextUrl);
    setPluginSelection("changelog", nextValue);
  }, [selectedEntry?.id]);

  useDelayedMarkRead({
    selectedItemId: selectedEntry?.id ?? null,
    isUnread: !selectedEntryIsRead && !selectedEntryIsArchived,
    onMarkRead: markRead,
    delayMs: MARK_READ_DELAY_MS,
  });

  const summaryStats = useMemo<SummaryStats>(
    () => ({
      watchedCount: watches.filter((watch) => watch.status !== "disabled").length,
      fullNotesCount: entries.filter((entry) => entry.notesQuality === "full").length,
      projectCount: projectSummaries.filter((project) => project.watchCount > 0).length,
      unreadCount: entries.filter(
        (entry) => !entryMeta[entry.id]?.readAt && !entryMeta[entry.id]?.archivedAt
      ).length,
      archivedCount: entries.filter((entry) => entryMeta[entry.id]?.archivedAt != null).length,
    }),
    [entries, entryMeta, projectSummaries, watches]
  );

  function openManager(initialSearch = "") {
    setOverlayUi((current) => ({
      ...current,
      manageSearch: initialSearch,
      manageOpen: true,
    }));
  }

  return (
    <SkeletonShimmer loading={!loaded}>
      <ThreePaneWorkspace
        className="bg-surface"
        initialSidebarWidth={320}
        initialListWidth={372}
        minSidebarWidth={300}
        minListWidth={320}
        minDetailWidth={460}
        sidebarClassName="border-r border-border bg-surface-raised flex flex-col"
        listClassName="border-r border-border flex flex-col"
        detailClassName="bg-surface flex flex-col"
        sidebarTabLabel="Projects"
        listTabLabel="Entries"
        detailKey={selectedEntry?.id ?? null}
        sidebar={
          <ChangelogSidebar
            isSyncing={isSyncing}
            sync={sync}
            summaryStats={summaryStats}
            syncState={syncState}
            error={error}
            entriesCount={entries.length}
            fullNotesCount={entries.filter((entry) => entry.notesQuality === "full").length}
            minimalNotesCount={entries.filter((entry) => entry.notesQuality === "minimal").length}
            prereleaseCount={entries.filter((entry) => entry.isPrerelease).length}
            scopeKey={effectiveScopeKey}
            setScopeKey={(value) => setOverlayUi((current) => ({ ...current, scopeKey: value }))}
            projectSummaries={projectSummaries}
            onOpenActions={() => setOverlayUi((current) => ({ ...current, actionsOpen: true }))}
            onOpenManager={openManager}
          />
        }
        list={
          <ChangelogList
            scopeKey={effectiveScopeKey}
            targets={targets}
            search={effectiveSearch}
            setSearch={(value) => setOverlayUi((current) => ({ ...current, search: value }))}
            filteredEntries={filteredEntries}
            entryMeta={entryMeta as Record<string, { readAt?: string; archivedAt?: string }>}
            markAllRead={markAllRead}
            readTab={effectiveReadTab}
            setReadTab={(value) => setOverlayUi((current) => ({ ...current, readTab: value }))}
            selectedEntryId={selectedEntry?.id ?? null}
            setSelectedEntryId={(value) =>
              setOverlayUi((current) => ({ ...current, selectedEntryId: value }))
            }
            markRead={markRead}
            markUnread={markUnread}
            archiveEntry={archiveEntry}
            unarchiveEntry={unarchiveEntry}
            projectMetaBySlug={projectMetaBySlug}
          />
        }
        detail={
          <ChangelogDetail
            selectedEntry={selectedEntry}
            selectedEntryIsRead={selectedEntryIsRead}
            selectedEntryIsArchived={selectedEntryIsArchived}
            markUnread={markUnread}
            unarchiveEntry={unarchiveEntry}
            archiveEntry={archiveEntry}
            selectedEntryPackage={selectedEntryPackage}
            selectedEntryWatches={selectedEntryWatches}
            projectMetaBySlug={projectMetaBySlug}
            onOpenManager={openManager}
          />
        }
      />

      <ChangelogManageDialog
        open={manageOpen}
        onOpenChange={(open) => setOverlayUi((current) => ({ ...current, manageOpen: open }))}
        watches={watches}
        manageSearch={manageSearch}
        setManageSearch={(value) =>
          setOverlayUi((current) => ({ ...current, manageSearch: value }))
        }
        projectMetaBySlug={projectMetaBySlug}
        setWatchStatus={setWatchStatus}
        togglePrereleases={togglePrereleases}
        removeWatch={removeWatch}
      />

      <ChangelogActionsDialog
        open={actionsOpen}
        onOpenChange={(open) => setOverlayUi((current) => ({ ...current, actionsOpen: open }))}
        targets={targets}
        isSyncing={isSyncing}
        importDependencies={importDependencies}
        addManualWatch={addManualWatch}
      />
    </SkeletonShimmer>
  );
}
