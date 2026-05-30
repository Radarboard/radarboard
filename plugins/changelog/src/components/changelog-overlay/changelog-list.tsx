import { PluginListHeader } from "@radarboard/plugin-sdk/components/list-header";
import { PluginListTabs } from "@radarboard/plugin-sdk/components/list-tabs";
import { toCompactProjectLabel } from "@radarboard/widget-engine/compact-project-badge";
import { CheckCheck } from "lucide-react";
import { useMemo } from "react";
import type { ChangelogEntry, ChangelogImportTarget } from "../../types";
import type { ReadTab, ScopeKey } from "../types";
import { formatMonthSeparator, scopeTitle } from "../utils";
import { MonthSeparator } from "./month-separator";
import { ReleaseListItem } from "./release-list-item";

interface ChangelogListProps {
  scopeKey: ScopeKey;
  targets: ChangelogImportTarget[];
  search: string;
  setSearch: (value: string) => void;
  filteredEntries: ChangelogEntry[];
  entryMeta: Record<string, { readAt?: string; archivedAt?: string }>;
  markAllRead: (ids: string[]) => void;
  readTab: ReadTab;
  setReadTab: (tab: ReadTab) => void;
  selectedEntryId: string | null;
  setSelectedEntryId: (id: string | null) => void;
  markRead: (id: string) => void;
  markUnread: (id: string) => void;
  archiveEntry: (id: string) => void;
  unarchiveEntry: (id: string) => void;
  projectMetaBySlug: Map<string, { name: string; color: string }>;
}

export function ChangelogList({
  scopeKey,
  targets,
  search,
  setSearch,
  filteredEntries,
  entryMeta,
  markAllRead,
  readTab,
  setReadTab,
  selectedEntryId,
  setSelectedEntryId,
  markRead,
  markUnread,
  archiveEntry,
  unarchiveEntry,
  projectMetaBySlug,
}: ChangelogListProps) {
  const groupedEntries = useMemo(() => {
    const groups: Array<
      { type: "month"; label: string } | { type: "entry"; entry: ChangelogEntry }
    > = [];
    let currentMonthLabel: string | null = null;

    for (const entry of filteredEntries) {
      const monthLabel = formatMonthSeparator(entry.publishedAt);
      if (monthLabel !== currentMonthLabel) {
        groups.push({ type: "month", label: monthLabel });
        currentMonthLabel = monthLabel;
      }
      groups.push({ type: "entry", entry });
    }

    return groups;
  }, [filteredEntries]);

  return (
    <>
      <PluginListHeader
        label={scopeTitle(scopeKey, targets)}
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Search packages, notes, versions...",
        }}
        count={`${filteredEntries.length} release${filteredEntries.length !== 1 ? "s" : ""}`}
        addButton={
          filteredEntries.some((entry) => !entryMeta[entry.id]?.readAt)
            ? {
                label: "Mark all read",
                icon: <CheckCheck className="icon-base" />,
                onClick: () => markAllRead(filteredEntries.map((entry) => entry.id)),
              }
            : undefined
        }
      />

      <PluginListTabs
        tabs={[
          { value: "inbox" as ReadTab, label: "Inbox" },
          { value: "archived" as ReadTab, label: "Archived" },
        ]}
        value={readTab}
        onChange={(value) => setReadTab(value as ReadTab)}
      />

      <div className="scrollbar-thin flex-1 overflow-y-auto overflow-x-hidden">
        {filteredEntries.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-dim text-sm">
            {readTab === "archived" ? "No archived releases." : "No releases match this view yet."}
          </div>
        ) : (
          <div className="divide-y divide-line">
            {groupedEntries.map((item) =>
              item.type === "month" ? (
                <MonthSeparator key={`month:${item.label}`} label={item.label} />
              ) : (
                <ReleaseListItem
                  key={item.entry.id}
                  entry={item.entry}
                  isRead={Boolean(entryMeta[item.entry.id]?.readAt)}
                  isArchived={Boolean(entryMeta[item.entry.id]?.archivedAt)}
                  projectBadges={item.entry.projectSlugs
                    .map((projectSlug) => {
                      const projectMeta = projectMetaBySlug.get(projectSlug);
                      return projectMeta
                        ? {
                            slug: projectSlug,
                            label: toCompactProjectLabel(projectMeta.name),
                            color: projectMeta.color,
                          }
                        : null;
                    })
                    .filter((badge): badge is { slug: string; label: string; color: string } =>
                      Boolean(badge)
                    )}
                  active={selectedEntryId === item.entry.id}
                  onSelect={() => setSelectedEntryId(item.entry.id)}
                  onMarkRead={() => markRead(item.entry.id)}
                  onMarkUnread={() => markUnread(item.entry.id)}
                  onArchive={() => archiveEntry(item.entry.id)}
                  onUnarchive={() => unarchiveEntry(item.entry.id)}
                />
              )
            )}
          </div>
        )}
      </div>
    </>
  );
}
