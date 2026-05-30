import { PluginEmptyState } from "@radarboard/plugin-sdk/components/plugin-empty";
import { Button } from "@radarboard/ui/button";
import { toCompactProjectLabel } from "@radarboard/widget-engine/compact-project-badge";
import { Archive, ArchiveRestore, ExternalLink, MailOpen, PackagePlus } from "lucide-react";
import type { ChangelogEntry, PackageWatch, TrackedPackage } from "../../types";
import { QUALITY_VARIANTS } from "../constants";
import { formatReleaseDate, getSourceVariant, repositoryLabel } from "../utils";
import { DetailCard, DetailRow, WatchUsageCard } from "./detail-card";
import { Pill } from "./pill";
import { ReleaseBodyRenderer } from "./release-body-renderer";

interface ChangelogDetailProps {
  selectedEntry: ChangelogEntry | null;
  selectedEntryIsRead: boolean;
  selectedEntryIsArchived: boolean;
  markUnread: (id: string) => void;
  unarchiveEntry: (id: string) => void;
  archiveEntry: (id: string) => void;
  selectedEntryPackage: TrackedPackage | null;
  selectedEntryWatches: PackageWatch[];
  projectMetaBySlug: Map<string, { name: string; color: string }>;
  onOpenManager: (packageName?: string) => void;
}

export function ChangelogDetail({
  selectedEntry,
  selectedEntryIsRead,
  selectedEntryIsArchived,
  markUnread,
  unarchiveEntry,
  archiveEntry,
  selectedEntryPackage,
  selectedEntryWatches,
  projectMetaBySlug,
  onOpenManager,
}: ChangelogDetailProps) {
  if (!selectedEntry) {
    return (
      <PluginEmptyState
        icon={<PackagePlus className="icon-lg" />}
        title="Select a release to inspect it here"
      />
    );
  }

  const selectedEntryRepositoryLabel = repositoryLabel(selectedEntryPackage?.repositoryUrl);

  return (
    <>
      <div className="border-border border-b px-3 py-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="font-mono text-dim text-w-sm uppercase tracking-[0.22em]">
              {selectedEntry.packageName}
            </div>
            <h1 className="mt-1 font-medium text-foreground text-w-xl leading-tight">
              {selectedEntry.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-dim text-w-base">
              <span>{formatReleaseDate(selectedEntry.publishedAt)}</span>
              <span>•</span>
              <span>v{selectedEntry.version}</span>
              <span>•</span>
              <span>{selectedEntry.sourceType.replace(/_/g, " ")}</span>
              {selectedEntryRepositoryLabel ? (
                <>
                  <span>•</span>
                  <span>{selectedEntryRepositoryLabel}</span>
                </>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {Boolean(selectedEntryIsRead) && (
              <Button
                type="button"
                onClick={() => markUnread(selectedEntry.id)}
                variant="outline"
                uppercase
                className="gap-1"
              >
                <MailOpen className="icon-sm" />
                Mark unread
              </Button>
            )}
            {selectedEntryIsArchived ? (
              <Button
                type="button"
                onClick={() => unarchiveEntry(selectedEntry.id)}
                variant="outline"
                uppercase
                className="gap-1"
              >
                <ArchiveRestore className="icon-sm" />
                Unarchive
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => archiveEntry(selectedEntry.id)}
                variant="outline"
                uppercase
                className="gap-1"
              >
                <Archive className="icon-sm" />
                Archive
              </Button>
            )}
            {selectedEntry.releaseUrl ? (
              <a
                href={selectedEntry.releaseUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-7 items-center gap-1 border border-border bg-surface px-2.5 font-mono text-foreground-secondary text-w-sm uppercase tracking-wider transition-colors hover:bg-surface-raised"
              >
                Open
                <ExternalLink className="icon-sm" />
              </a>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Pill variant="success">v{selectedEntry.version}</Pill>
          <Pill variant={QUALITY_VARIANTS[selectedEntry.notesQuality]}>
            {selectedEntry.notesQuality === "full" ? "Full notes" : "Minimal notes"}
          </Pill>
          <Pill variant={getSourceVariant(selectedEntry.sourceType)}>
            {selectedEntry.sourceType.replace(/_/g, " ")}
          </Pill>
          {selectedEntry.isPrerelease ? <Pill variant="purple">Prerelease</Pill> : null}
        </div>
      </div>

      <div className="scrollbar-thin flex-1 overflow-y-auto overflow-x-hidden px-3 py-3">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <section className="min-w-0 border border-border bg-surface-raised px-3 py-2">
            <div className="mb-3 font-mono text-dim text-w-sm uppercase tracking-[0.22em]">
              Release Notes
            </div>
            <ReleaseBodyRenderer entry={selectedEntry} />
          </section>

          <div className="min-w-0 space-y-3">
            <DetailCard title="Package Metadata">
              <DetailRow label="Package" value={selectedEntry.packageName} />
              <DetailRow label="Source" value={selectedEntry.sourceType.replace(/_/g, " ")} />
              <DetailRow
                label="Homepage"
                value={
                  selectedEntryPackage?.homepageUrl ? (
                    <a
                      href={selectedEntryPackage.homepageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent hover:text-accent/80"
                    >
                      {selectedEntryPackage.homepageUrl}
                    </a>
                  ) : (
                    "—"
                  )
                }
              />
              <DetailRow
                label="Repository"
                value={
                  selectedEntryPackage?.repositoryUrl ? (
                    <a
                      href={selectedEntryPackage.repositoryUrl.replace(/^git\+/, "")}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent hover:text-accent/80"
                    >
                      {selectedEntryPackage.repositoryUrl}
                    </a>
                  ) : (
                    "—"
                  )
                }
              />
            </DetailCard>

            <DetailCard title="Tracking">
              {selectedEntryWatches.length === 0 ? (
                <div className="text-dim text-sm">No active watch mappings.</div>
              ) : (
                <div className="space-y-3">
                  <Button
                    type="button"
                    onClick={() => onOpenManager(selectedEntry.packageName)}
                    variant="outline"
                    uppercase
                    className="gap-1.5"
                  >
                    Manage package watches
                  </Button>
                  {selectedEntryWatches.map((watch) => (
                    <WatchUsageCard
                      key={watch.id}
                      watch={watch}
                      projectColor={projectMetaBySlug.get(watch.projectSlug)?.color ?? "#777777"}
                      projectLabel={toCompactProjectLabel(
                        projectMetaBySlug.get(watch.projectSlug)?.name ?? watch.projectName
                      )}
                    />
                  ))}
                </div>
              )}
            </DetailCard>
          </div>
        </div>
      </div>
    </>
  );
}
