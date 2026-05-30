import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@radarboard/ui/app-dialog";
import { Button } from "@radarboard/ui/button";
import { Input } from "@radarboard/ui/input";
import { PackagePlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ChangelogImportTarget } from "../../types";
import { PanelCard, TargetSelect } from "./panel-card";

interface ChangelogActionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targets: ChangelogImportTarget[];
  isSyncing: boolean;
  importDependencies: (projectSlug: string, platformId: string) => Promise<void>;
  addManualWatch: (params: {
    projectSlug: string;
    platformId: string;
    packageName: string;
  }) => Promise<void>;
}

export function ChangelogActionsDialog({
  open,
  onOpenChange,
  targets,
  isSyncing,
  importDependencies,
  addManualWatch,
}: ChangelogActionsDialogProps) {
  const [selectedImportTargetKey, setSelectedImportTargetKey] = useState("");
  const [selectedManualTargetKey, setSelectedManualTargetKey] = useState("");
  const [manualPackageName, setManualPackageName] = useState("");

  const importableTargets = useMemo(
    () => targets.filter((target) => Boolean(target.githubRepo)),
    [targets]
  );

  useEffect(() => {
    const firstImportableTarget = importableTargets[0];
    if (
      selectedImportTargetKey &&
      importableTargets.some(
        (target) => `${target.projectSlug}:${target.platformId}` === selectedImportTargetKey
      )
    ) {
      return;
    }
    setSelectedImportTargetKey(
      firstImportableTarget
        ? `${firstImportableTarget.projectSlug}:${firstImportableTarget.platformId}`
        : ""
    );
  }, [importableTargets, selectedImportTargetKey]);

  useEffect(() => {
    const firstTarget = targets[0];
    if (
      selectedManualTargetKey &&
      targets.some(
        (target) => `${target.projectSlug}:${target.platformId}` === selectedManualTargetKey
      )
    ) {
      return;
    }
    setSelectedManualTargetKey(
      firstTarget ? `${firstTarget.projectSlug}:${firstTarget.platformId}` : ""
    );
  }, [selectedManualTargetKey, targets]);

  const selectedImportTarget = useMemo(
    () =>
      importableTargets.find(
        (target) => `${target.projectSlug}:${target.platformId}` === selectedImportTargetKey
      ) ?? null,
    [importableTargets, selectedImportTargetKey]
  );

  const selectedManualTarget = useMemo(
    () =>
      targets.find(
        (target) => `${target.projectSlug}:${target.platformId}` === selectedManualTargetKey
      ) ?? null,
    [selectedManualTargetKey, targets]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" className="rounded-none border-border bg-secondary">
        <DialogHeader>
          <DialogTitle>Actions</DialogTitle>
          <DialogDescription>
            Import dependencies from GitHub-backed projects or add a package watch manually.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-4 overflow-x-hidden md:grid-cols-2">
          <PanelCard title="Import From GitHub" variant="accent">
            {importableTargets.length > 0 ? (
              <>
                <TargetSelect
                  targets={importableTargets}
                  selectedTargetKey={selectedImportTargetKey}
                  onChange={setSelectedImportTargetKey}
                />
                <Button
                  type="button"
                  onClick={() => {
                    if (!selectedImportTarget) return;
                    importDependencies(
                      selectedImportTarget.projectSlug,
                      selectedImportTarget.platformId
                    )
                      .then(() => onOpenChange(false))
                      .catch((_err) => {
                        /* errors are handled by toast inside hook */
                      });
                  }}
                  disabled={!selectedImportTarget || isSyncing}
                  variant="outline-accent"
                  uppercase
                  className="gap-1.5"
                >
                  <PackagePlus className="icon-sm" />
                  Import Dependencies
                </Button>
                <div className="border border-border bg-surface px-3 py-2 text-dim text-w-sm leading-5">
                  {selectedImportTarget?.githubRepo
                    ? `Pulls direct dependencies from ${selectedImportTarget.githubRepo.owner}/${selectedImportTarget.githubRepo.repo}.`
                    : "No GitHub-backed target selected."}
                </div>
              </>
            ) : (
              <div className="border border-border bg-surface px-3 py-2 text-dim text-w-sm leading-5">
                No GitHub-backed targets yet. Add GitHub repo mappings to a project platform first.
              </div>
            )}
          </PanelCard>

          <PanelCard title="Add Manual Package" variant="success">
            <TargetSelect
              targets={targets}
              selectedTargetKey={selectedManualTargetKey}
              onChange={setSelectedManualTargetKey}
            />
            <div className="space-y-2">
              <Input
                type="text"
                value={manualPackageName}
                onChange={(event) => setManualPackageName(event.target.value)}
                placeholder="@scope/package"
                variant="surface"
                size="lg"
                className="bg-surface text-sm"
              />
              <Button
                type="button"
                disabled={!selectedManualTarget || !manualPackageName.trim()}
                variant="outline"
                uppercase
                className="border-success/40 bg-success-bg text-success hover:bg-success/20"
                onClick={() => {
                  if (!selectedManualTarget || !manualPackageName.trim()) return;
                  addManualWatch({
                    projectSlug: selectedManualTarget.projectSlug,
                    platformId: selectedManualTarget.platformId,
                    packageName: manualPackageName.trim(),
                  })
                    .then(() => {
                      setManualPackageName("");
                      onOpenChange(false);
                    })
                    .catch((_err) => {
                      /* errors are handled by toast inside hook */
                    });
                }}
              >
                Add Package
              </Button>
            </div>
          </PanelCard>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
