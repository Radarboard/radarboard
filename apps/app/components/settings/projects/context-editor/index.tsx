"use client";

import type {
  GoalStatus,
  PriorityEffort,
  PriorityImpact,
  PriorityStatus,
  ProjectContext,
  ProjectGoal,
  ProjectPriority,
  ProjectStage,
} from "@radarboard/types/project-context";
import { Button } from "@radarboard/ui/button";
import { Input } from "@radarboard/ui/input";
import { RichTextComposer } from "@radarboard/ui/rich-text-composer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@radarboard/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@radarboard/ui/tooltip";
import { cn } from "@radarboard/utils/cn";
import { FlagIcon, GoalIcon, PlusIcon, StickyNoteIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PROJECT_STAGES: { value: ProjectStage; label: string }[] = [
  { value: "idea", label: "Idea" },
  { value: "mvp", label: "MVP" },
  { value: "growth", label: "Growth" },
  { value: "mature", label: "Mature" },
  { value: "sunset", label: "Sunset" },
];

const GOAL_STATUSES: GoalStatus[] = ["active", "achieved", "dropped"];
const PRIORITY_IMPACTS: PriorityImpact[] = ["low", "medium", "high"];
const PRIORITY_EFFORTS: PriorityEffort[] = ["small", "medium", "large"];
const PRIORITY_STATUSES: PriorityStatus[] = ["active", "done", "dropped"];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ContextEditorProps {
  context: ProjectContext;
  onChange: (ctx: ProjectContext) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StagePicker({
  stage,
  onChange,
}: {
  stage: ProjectStage | undefined;
  onChange: (stage: ProjectStage | undefined) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {PROJECT_STAGES.map((s) => (
        <Button
          key={s.value}
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange(stage === s.value ? undefined : s.value)}
          className={cn(
            "uppercase-none h-auto rounded-item px-2 py-0.5 font-mono text-w-sm transition-colors",
            stage === s.value
              ? "border-accent/30 bg-accent/20 text-accent"
              : "border-border bg-surface text-dim hover:border-accent/40"
          )}
        >
          {s.label}
        </Button>
      ))}
    </div>
  );
}

export function ContextEditor({ context, onChange }: ContextEditorProps) {
  const [tab, setTab] = useState<"goals" | "priorities" | "notes">("goals");

  return (
    <div className="border-border border-b px-5 pt-3 pb-4">
      {/* Tab bar */}
      <div className="mb-3 flex gap-1 border-border border-b">
        {[
          { id: "goals" as const, label: "Goals", icon: GoalIcon },
          { id: "priorities" as const, label: "Priorities", icon: FlagIcon },
          { id: "notes" as const, label: "Notes", icon: StickyNoteIcon },
        ].map((t) => (
          <Button
            key={t.id}
            type="button"
            variant="ghost"
            onClick={() => setTab(t.id)}
            className={cn(
              "uppercase-none -mb-px flex h-auto items-center gap-1.5 rounded-none px-3 py-1.5 font-mono font-normal text-w-sm transition-colors",
              tab === t.id
                ? "border-accent border-b-2 text-foreground"
                : "text-dim hover:text-foreground-secondary"
            )}
          >
            <t.icon size={11} />
            {t.label}
            {t.id === "goals" && context.goals.length > 0 && (
              <span className="rounded-item bg-secondary px-1 text-w-sm">
                {context.goals.length}
              </span>
            )}
            {t.id === "priorities" && context.priorities.length > 0 && (
              <span className="rounded-item bg-secondary px-1 text-w-sm">
                {context.priorities.length}
              </span>
            )}
          </Button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "goals" && (
        <GoalsEditor goals={context.goals} onChange={(goals) => onChange({ ...context, goals })} />
      )}
      {tab === "priorities" && (
        <PrioritiesEditor
          priorities={context.priorities}
          onChange={(priorities) => onChange({ ...context, priorities })}
        />
      )}
      {tab === "notes" && (
        <NotesEditor notes={context.notes} onChange={(notes) => onChange({ ...context, notes })} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

function GoalsEditor({
  goals,
  onChange,
}: {
  goals: ProjectGoal[];
  onChange: (goals: ProjectGoal[]) => void;
}) {
  const addGoal = () => {
    onChange([...goals, { id: crypto.randomUUID(), title: "", status: "active" }]);
  };

  const updateGoal = (index: number, updates: Partial<ProjectGoal>) => {
    const next = [...goals];
    const existing = next[index];
    if (existing) next[index] = { ...existing, ...updates };
    onChange(next);
  };

  const removeGoal = (index: number) => {
    onChange(goals.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      {goals.length === 0 ? (
        <div className="rounded-item border border-border border-dashed bg-secondary/30 px-3 py-4">
          <div className="mb-1 font-mono text-foreground-secondary text-w-sm uppercase tracking-wider">
            No goals yet
          </div>
          <p className="mb-3 max-w-[520px] text-dim text-w-sm">
            Track the main outcome this project is trying to achieve, like launching v1, reaching
            revenue targets, or improving retention.
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={addGoal}
            className="uppercase-none h-auto p-0 text-accent hover:bg-transparent hover:text-accent/80"
          >
            <PlusIcon size={12} className="mr-1" /> Add first goal
          </Button>
        </div>
      ) : null}

      {goals.map((goal, i) => (
        <div key={goal.id} className="group flex items-start gap-2">
          <Input
            type="text"
            value={goal.title}
            onChange={(e) => updateGoal(i, { title: e.target.value })}
            placeholder="Goal title…"
            className="h-8 flex-1 font-mono text-w-sm"
          />
          <Select
            value={goal.status}
            onValueChange={(v) => updateGoal(i, { status: v as GoalStatus })}
          >
            <SelectTrigger className="h-8 w-auto min-w-[80px] font-mono text-w-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GOAL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={goal.targetDate ?? ""}
            onChange={(e) => updateGoal(i, { targetDate: e.target.value || undefined })}
            className="h-8 w-[120px] font-mono text-w-sm"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => removeGoal(i)}
            className="uppercase-none h-8 w-8 text-dim opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
            aria-label="Remove goal"
          >
            <Trash2Icon size={12} />
          </Button>
        </div>
      ))}

      {goals.length > 0 ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={addGoal}
          className="uppercase-none h-auto p-0 text-accent hover:bg-transparent hover:text-accent/80"
        >
          <PlusIcon size={12} className="mr-1" /> Add goal
        </Button>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Priorities
// ---------------------------------------------------------------------------

function PrioritiesEditor({
  priorities,
  onChange,
}: {
  priorities: ProjectPriority[];
  onChange: (priorities: ProjectPriority[]) => void;
}) {
  const addPriority = () => {
    onChange([
      ...priorities,
      { id: crypto.randomUUID(), title: "", impact: "medium", effort: "medium", status: "active" },
    ]);
  };

  const updatePriority = (index: number, updates: Partial<ProjectPriority>) => {
    const next = [...priorities];
    const existing = next[index];
    if (existing) next[index] = { ...existing, ...updates };
    onChange(next);
  };

  const removePriority = (index: number) => {
    onChange(priorities.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      {priorities.map((p, i) => (
        <div key={p.id} className="group flex items-start gap-2">
          <Input
            type="text"
            value={p.title}
            onChange={(e) => updatePriority(i, { title: e.target.value })}
            placeholder="Priority…"
            className="h-8 flex-1 font-mono text-w-sm"
          />
          <Select
            value={p.impact}
            onValueChange={(v) => updatePriority(i, { impact: v as PriorityImpact })}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <SelectTrigger className="h-8 w-auto min-w-[90px] font-mono text-w-sm">
                  <SelectValue />
                </SelectTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">Impact</TooltipContent>
            </Tooltip>
            <SelectContent>
              {PRIORITY_IMPACTS.map((v) => (
                <SelectItem key={v} value={v}>
                  {v} impact
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={p.effort}
            onValueChange={(v) => updatePriority(i, { effort: v as PriorityEffort })}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <SelectTrigger className="h-8 w-auto min-w-[90px] font-mono text-w-sm">
                  <SelectValue />
                </SelectTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">Effort</TooltipContent>
            </Tooltip>
            <SelectContent>
              {PRIORITY_EFFORTS.map((v) => (
                <SelectItem key={v} value={v}>
                  {v} effort
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={p.status}
            onValueChange={(v) => updatePriority(i, { status: v as PriorityStatus })}
          >
            <SelectTrigger className="h-8 w-auto min-w-[80px] font-mono text-w-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => removePriority(i)}
            className="uppercase-none h-8 w-8 text-dim opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
            aria-label="Remove priority"
          >
            <Trash2Icon size={12} />
          </Button>
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        onClick={addPriority}
        className="uppercase-none h-auto p-0 text-accent hover:bg-transparent hover:text-accent/80"
      >
        <PlusIcon size={12} className="mr-1" /> Add priority
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

function NotesEditor({ notes, onChange }: { notes: string; onChange: (notes: string) => void }) {
  return (
    <div>
      <p className="mb-2 font-mono text-dim text-w-sm">
        Free-form notes injected into the AI system prompt. Add context the AI should always know.
      </p>
      <RichTextComposer
        value={notes}
        onChange={(next) => onChange(next)}
        placeholder="e.g. This project targets Japanese users. Focus on mobile-first design. Revenue model is freemium with in-app purchases…"
        className="bg-secondary/50"
        editorClassName="min-h-[160px] text-w-sm text-foreground-secondary placeholder:text-dim/40"
      />
    </div>
  );
}
