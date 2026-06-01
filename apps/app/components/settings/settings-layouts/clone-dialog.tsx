"use client";

import type { LayoutDefinition } from "@radarboard/types/database";
import type { Project } from "@radarboard/types/project";
import {
  Dialog,
  DialogBody,
  DialogCancelButton,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@radarboard/ui/app-dialog";
import { Button } from "@radarboard/ui/button";
import { Input } from "@radarboard/ui/input";
import { Label } from "@radarboard/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@radarboard/ui/select";
import { cn } from "@radarboard/utils/cn";
import { useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DuplicateTarget =
  | { type: "same-project" }
  | { type: "existing-project"; projectSlug: string }
  | { type: "new-project"; projectName: string; projectColor: string };

interface DuplicateLayoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layout: LayoutDefinition;
  sourceProjectName: string;
  sourcePageName: string;
  projects: Project[];
  onDuplicate: (target: DuplicateTarget, pageName: string) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROJECT_COLORS = [
  "#E63946",
  "#457B9D",
  "#2A9D8F",
  "#F4A261",
  "#8B5CF6",
  "#EC4899",
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#6366F1",
];

type TargetType = "same-project" | "existing-project" | "new-project";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DuplicateLayoutDialog({
  open,
  onOpenChange,
  layout,
  sourceProjectName,
  sourcePageName,
  projects,
  onDuplicate,
}: DuplicateLayoutDialogProps) {
  const [dialogState, setDialogState] = useState<{
    newProjectColor: string;
    newProjectName: string;
    pageName: string;
    selectedProjectSlug: string;
    targetType: TargetType;
  }>({
    newProjectColor: PROJECT_COLORS[0] ?? "#3B82F6",
    newProjectName: "",
    pageName: `Copy of ${sourcePageName}`,
    selectedProjectSlug: projects[0]?.slug ?? "",
    targetType: "same-project",
  });
  const { newProjectColor, newProjectName, pageName, selectedProjectSlug, targetType } =
    dialogState;

  // Reset state when dialog opens
  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setDialogState({
        newProjectColor: PROJECT_COLORS[0] ?? "#3B82F6",
        newProjectName: "",
        pageName: `Copy of ${sourcePageName}`,
        selectedProjectSlug: projects[0]?.slug ?? "",
        targetType: "same-project",
      });
    }
    onOpenChange(nextOpen);
  }

  function handleDuplicate() {
    const trimmedPageName = pageName.trim();
    if (!trimmedPageName) return;

    if (targetType === "same-project") {
      onDuplicate({ type: "same-project" }, trimmedPageName);
    } else if (targetType === "existing-project") {
      if (!selectedProjectSlug) return;
      onDuplicate({ type: "existing-project", projectSlug: selectedProjectSlug }, trimmedPageName);
    } else {
      const trimmedProjectName = newProjectName.trim();
      if (!trimmedProjectName) return;
      onDuplicate(
        { type: "new-project", projectName: trimmedProjectName, projectColor: newProjectColor },
        trimmedPageName
      );
    }
  }

  const canSubmit =
    pageName.trim().length > 0 &&
    (targetType === "same-project" ||
      (targetType === "existing-project" && selectedProjectSlug.length > 0) ||
      (targetType === "new-project" && newProjectName.trim().length > 0));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Duplicate Layout</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {/* Layout info */}
          <div className="rounded-item border border-border bg-surface px-3 py-2">
            <p className="font-mono text-dim text-w-sm">
              Layout: <span className="text-foreground">{layout.name}</span>
            </p>
          </div>

          {/* Target selection */}
          <fieldset className="space-y-2">
            <Label className="mb-0 font-mono text-dim text-w-sm uppercase tracking-widest">
              Duplicate to
            </Label>

            <TargetOption
              value="same-project"
              label="Same project"
              description={sourceProjectName}
              checked={targetType === "same-project"}
              onChange={(value) => setDialogState((current) => ({ ...current, targetType: value }))}
            />

            <TargetOption
              value="existing-project"
              label="Existing project"
              description="Choose a project"
              checked={targetType === "existing-project"}
              onChange={(value) => setDialogState((current) => ({ ...current, targetType: value }))}
            />

            {targetType === "existing-project" && (
              <div className="pl-7">
                <Select
                  value={selectedProjectSlug}
                  onValueChange={(value) =>
                    setDialogState((current) => ({ ...current, selectedProjectSlug: value }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.slug} value={project.slug}>
                        <span className="flex items-center gap-2">
                          <span
                            className="inline-block size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: project.color }}
                          />
                          {project.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <TargetOption
              value="new-project"
              label="New project"
              description="Create a new project"
              checked={targetType === "new-project"}
              onChange={(value) => setDialogState((current) => ({ ...current, targetType: value }))}
            />

            {targetType === "new-project" && (
              <div className="space-y-3 pl-7">
                <Input
                  placeholder="Project name"
                  value={newProjectName}
                  onChange={(e) =>
                    setDialogState((current) => ({ ...current, newProjectName: e.target.value }))
                  }
                />
                <div className="space-y-1.5">
                  <Label className="mb-0 font-mono text-dim text-w-sm uppercase tracking-widest">
                    Color
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {PROJECT_COLORS.map((color) => (
                      <Button
                        key={color}
                        type="button"
                        className={cn(
                          "size-6 rounded-full border-2 transition-transform hover:scale-110",
                          newProjectColor === color
                            ? "scale-110 border-foreground"
                            : "border-transparent"
                        )}
                        variant="ghost"
                        size="icon"
                        spacing="none"
                        rounded="full"
                        style={{ backgroundColor: color }}
                        onClick={() =>
                          setDialogState((current) => ({ ...current, newProjectColor: color }))
                        }
                        aria-pressed={newProjectColor === color}
                        aria-label={`Select color ${color}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </fieldset>

          {/* Page name */}
          <div className="space-y-1.5">
            <Label
              htmlFor="duplicate-page-name"
              className="mb-0 font-mono text-dim text-w-sm uppercase tracking-widest"
            >
              Page Name
            </Label>
            <Input
              id="duplicate-page-name"
              value={pageName}
              onChange={(e) =>
                setDialogState((current) => ({ ...current, pageName: e.target.value }))
              }
              placeholder="Page name"
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <DialogCancelButton />
          <Button type="button" disabled={!canSubmit} onClick={handleDuplicate}>
            Duplicate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// TargetOption — radio-like styled option
// ---------------------------------------------------------------------------

function TargetOption({
  value,
  label,
  description,
  checked,
  onChange,
}: {
  value: TargetType;
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: TargetType) => void;
}) {
  return (
    <Button
      type="button"
      variant={checked ? "secondary" : "outline"}
      uppercase={false}
      fullWidth
      role="radio"
      aria-checked={checked}
      onClick={() => onChange(value)}
      className={cn(
        "h-auto items-center justify-start gap-3 px-3 py-2 text-left transition-colors",
        checked
          ? "border-foreground/30 bg-surface"
          : "border-border bg-transparent hover:bg-surface/50"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-3.5 shrink-0 rounded-full border border-border",
          checked ? "border-foreground bg-foreground" : "bg-transparent"
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="font-mono text-foreground text-w-sm">{label}</p>
        <p className="truncate text-dim text-w-xs">{description}</p>
      </div>
    </Button>
  );
}
