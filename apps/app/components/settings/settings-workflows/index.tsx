"use client";

import type { Workflow, WorkflowTrigger } from "@radarboard/feature-workflows/types";
import { useEffectiveLocale } from "@radarboard/hooks/use-effective-locale";
import { useEffectiveTimeZone } from "@radarboard/hooks/use-effective-timezone";
import { API_ROUTES, buildApiRoute } from "@radarboard/types/api-routes";
import { Button } from "@radarboard/ui/button";
import { Switch } from "@radarboard/ui/switch";
import { cn } from "@radarboard/utils/cn";
import { formatDateTime } from "@radarboard/utils/format-date-time";
import { Clock, Play, Trash2, Zap } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { CollapsibleListPanel, ListPanelHeader } from "../settings-list-panel";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function triggerLabel(trigger: WorkflowTrigger): string {
  switch (trigger.type) {
    case "schedule":
      return `Cron: ${trigger.cron}`;
    case "event":
      return `Event: ${trigger.channel}/${trigger.eventType}`;
    case "threshold":
      return `${trigger.dataSource} ${trigger.operator} ${trigger.value}`;
    default:
      return "Unknown trigger";
  }
}

function triggerIcon(trigger: WorkflowTrigger) {
  switch (trigger.type) {
    case "schedule":
      return Clock;
    case "event":
      return Zap;
    case "threshold":
      return Play;
    default:
      return Zap;
  }
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function WorkflowListItem({
  workflow,
  isSelected,
  onSelect,
}: {
  workflow: Workflow;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const Icon = triggerIcon(workflow.trigger);

  return (
    <div
      role="option"
      aria-selected={isSelected}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-md border border-transparent px-3 py-2 text-left transition-colors",
        isSelected ? "border-accent/40 bg-accent/5" : "hover:bg-muted"
      )}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      tabIndex={0}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-dim" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-mono text-xs">{workflow.name}</div>
        <div className="truncate text-dim text-w-xs">{triggerLabel(workflow.trigger)}</div>
      </div>
      <div
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          workflow.enabled ? "bg-success" : "bg-muted"
        )}
      />
    </div>
  );
}

function WorkflowDetailPanel({
  workflow,
  onToggleEnabled,
  onDelete,
  effectiveLocale,
  effectiveTimeZone,
}: {
  workflow: Workflow;
  onToggleEnabled: () => void;
  onDelete: () => void;
  effectiveLocale: string;
  effectiveTimeZone: string;
}) {
  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h2 className="font-mono font-semibold text-sm">{workflow.name}</h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-dim text-w-xs">Enabled</span>
              <Switch checked={workflow.enabled} onCheckedChange={onToggleEnabled} />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onDelete}
              className="h-7 w-7 text-dim hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        {workflow.description && <p className="mt-1 text-dim text-w-sm">{workflow.description}</p>}
      </div>

      <div className="space-y-4">
        <div>
          <div className="mb-1 font-mono text-dim text-w-xs uppercase tracking-widest">Trigger</div>
          <div className="rounded border border-border bg-surface-secondary px-3 py-2 font-mono text-w-sm">
            {triggerLabel(workflow.trigger)}
          </div>
        </div>

        <div>
          <div className="mb-1 font-mono text-dim text-w-xs uppercase tracking-widest">Steps</div>
          <div className="space-y-1">
            {workflow.steps.map((step, i) => (
              <div
                key={`${workflow.id}-${step.type}-${JSON.stringify(step)}`}
                className="rounded border border-border bg-surface-secondary px-3 py-2 font-mono text-w-sm"
              >
                <span className="text-dim">#{i + 1}</span>{" "}
                <span className="font-semibold">{step.type}</span>
                {"outputVar" in step && (
                  <span className="text-dim"> → {(step as { outputVar: string }).outputVar}</span>
                )}
              </div>
            ))}
            {workflow.steps.length === 0 && (
              <p className="py-2 text-dim text-w-sm">No steps configured.</p>
            )}
          </div>
        </div>

        <div className="flex gap-6 text-dim text-w-xs">
          <span>
            Created:{" "}
            {formatDateTime(workflow.createdAt, {
              locale: effectiveLocale,
              timeZone: effectiveTimeZone,
            })}
          </span>
          <span>
            Updated:{" "}
            {formatDateTime(workflow.updatedAt, {
              locale: effectiveLocale,
              timeZone: effectiveTimeZone,
            })}
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function SettingsWorkflows() {
  const effectiveLocale = useEffectiveLocale();
  const effectiveTimeZone = useEffectiveTimeZone();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(API_ROUTES.workflows);
      if (res.ok) {
        const data = (await res.json()) as { workflows: Workflow[] };
        setWorkflows(data.workflows ?? []);
      }
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = search
    ? workflows.filter((w) => w.name.toLowerCase().includes(search.toLowerCase()))
    : workflows;

  const selectedWorkflow = workflows.find((w) => w.id === selectedId);

  const handleCreate = useCallback(async () => {
    try {
      const res = await fetch(API_ROUTES.workflows, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Workflow ${workflows.length + 1}`,
          description: "",
          trigger: { type: "schedule", cron: "0 8 * * *" },
          steps: [],
        }),
      });
      if (res.ok) {
        const workflow = (await res.json()) as Workflow;
        await refresh();
        setSelectedId(workflow.id);
      }
    } catch {
      // Non-critical
    }
  }, [workflows.length, refresh]);

  const handleDelete = useCallback(
    async (id: string) => {
      await fetch(buildApiRoute(API_ROUTES.workflows, { id }), { method: "DELETE" });
      if (selectedId === id) setSelectedId(null);
      await refresh();
    },
    [selectedId, refresh]
  );

  const handleToggleEnabled = useCallback(
    (_id: string) => {
      // Toggle requires a PATCH endpoint — for now refresh to get latest state
      refresh();
    },
    [refresh]
  );

  return (
    <div className="relative flex h-full min-h-0 overflow-hidden">
      <CollapsibleListPanel>
        <ListPanelHeader
          title="Workflows"
          subtitle="Automation rules triggered by events."
          searchPlaceholder="Search workflows..."
          searchValue={search}
          onSearchChange={setSearch}
          onAdd={handleCreate}
          addLabel="Create new workflow"
        />

        <div className="scrollbar-thin flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {filtered.length === 0 && (
            <p className="py-4 text-center font-mono text-dim text-w-xs">
              {workflows.length === 0
                ? "No workflows yet. Create one or ask the AI assistant."
                : "No workflows match your search."}
            </p>
          )}
          {filtered.map((wf) => (
            <WorkflowListItem
              key={wf.id}
              workflow={wf}
              isSelected={wf.id === selectedId}
              onSelect={() => setSelectedId(wf.id)}
            />
          ))}
        </div>
      </CollapsibleListPanel>

      <div className="min-w-0 flex-1 overflow-hidden">
        {selectedWorkflow ? (
          <WorkflowDetailPanel
            workflow={selectedWorkflow}
            onToggleEnabled={() => handleToggleEnabled(selectedWorkflow.id)}
            onDelete={() => handleDelete(selectedWorkflow.id)}
            effectiveLocale={effectiveLocale}
            effectiveTimeZone={effectiveTimeZone}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-8 text-center">
            <Zap className="mb-3 h-8 w-8 text-dim" />
            <p className="font-mono text-dim text-w-sm">
              Select a workflow to view details, or create a new one.
            </p>
            <p className="mt-2 text-dim text-w-xs">
              Tip: Ask the AI assistant to create workflows with natural language.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
