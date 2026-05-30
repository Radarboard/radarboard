import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@radarboard/ui/app-dialog";
import { Input } from "@radarboard/ui/input";
import { toCompactProjectLabel } from "@radarboard/widget-engine/compact-project-badge";
import { Search } from "lucide-react";
import { useDeferredValue, useMemo } from "react";
import type { PackageWatch } from "../../types";
import { Pill } from "./pill";
import { WatchControlCard } from "./watch-control-card";

interface ChangelogManageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  watches: PackageWatch[];
  manageSearch: string;
  setManageSearch: (search: string) => void;
  projectMetaBySlug: Map<string, { name: string; color: string }>;
  setWatchStatus: (id: string, status: PackageWatch["status"]) => void;
  togglePrereleases: (id: string) => void;
  removeWatch: (id: string) => void;
}

export function ChangelogManageDialog({
  open,
  onOpenChange,
  watches,
  manageSearch,
  setManageSearch,
  projectMetaBySlug,
  setWatchStatus,
  togglePrereleases,
  removeWatch,
}: ChangelogManageDialogProps) {
  const deferredManageSearch = useDeferredValue(manageSearch.trim().toLowerCase());

  const managedWatches = useMemo(() => {
    return [...watches]
      .filter((watch) => {
        if (!deferredManageSearch) return true;
        return [watch.packageName, watch.projectName, watch.platformName]
          .join(" ")
          .toLowerCase()
          .includes(deferredManageSearch);
      })
      .sort((left, right) =>
        `${left.projectName}:${left.platformName}:${left.packageName}`.localeCompare(
          `${right.projectName}:${right.platformName}:${right.packageName}`
        )
      );
  }, [deferredManageSearch, watches]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" className="rounded-none border-border bg-secondary">
        <DialogHeader>
          <DialogTitle>Package Manager</DialogTitle>
          <DialogDescription>
            Manage muted, disabled, manual, and prerelease tracking rules without leaving the
            changelog feed.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4 overflow-x-hidden">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-0 flex-1">
              <Search className="icon-sm absolute top-1/2 left-3 -translate-y-1/2 text-dim" />
              <Input
                type="text"
                value={manageSearch}
                onChange={(event) => setManageSearch(event.target.value)}
                placeholder="Search watched packages, projects, platforms"
                variant="surface"
                size="lg"
                className="bg-surface pr-3 pl-10 text-sm"
              />
            </div>
            <Pill variant="dim">{managedWatches.length} packages</Pill>
          </div>

          {managedWatches.length === 0 ? (
            <div className="border border-border border-dashed bg-secondary/50 px-4 py-10 text-center text-dim text-sm">
              No watched packages match this search.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {managedWatches.map((watch) => (
                <WatchControlCard
                  key={watch.id}
                  watch={watch}
                  projectColor={projectMetaBySlug.get(watch.projectSlug)?.color ?? "#777777"}
                  projectLabel={toCompactProjectLabel(
                    projectMetaBySlug.get(watch.projectSlug)?.name ?? watch.projectName
                  )}
                  onToggleMute={() =>
                    setWatchStatus(watch.id, watch.status === "muted" ? "active" : "muted")
                  }
                  onToggleDisabled={() =>
                    setWatchStatus(watch.id, watch.status === "disabled" ? "active" : "disabled")
                  }
                  onTogglePrereleases={() => togglePrereleases(watch.id)}
                  onRemove={() => removeWatch(watch.id)}
                />
              ))}
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
