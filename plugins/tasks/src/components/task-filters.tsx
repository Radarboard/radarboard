"use client";

import { FilterBar } from "@radarboard/plugin-sdk/components/filter-bar";
import type { TaskPriority, TaskStatus } from "../types";

const STATUSES: { value: TaskStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "todo", label: "Todo" },
  { value: "in-progress", label: "In Progress" },
  { value: "done", label: "Done" },
  { value: "archived", label: "Archived" },
];

const PRIORITIES: { value: TaskPriority | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Med" },
  { value: "low", label: "Low" },
];

interface TaskFiltersProps {
  statusFilter: TaskStatus | "all";
  priorityFilter: TaskPriority | "all";
  viewMode: "active" | "trash";
  onStatusChange: (status: TaskStatus | "all") => void;
  onPriorityChange: (priority: TaskPriority | "all") => void;
  onViewModeChange: (mode: "active" | "trash") => void;
  /** Current display mode — status filter is hidden in kanban mode. */
  displayMode: "list" | "kanban";
}

export function TaskFilters({
  statusFilter,
  priorityFilter,
  onStatusChange,
  onPriorityChange,
  displayMode,
}: TaskFiltersProps) {
  return (
    <div className="flex items-center gap-4 border-border border-b px-3 py-1.5">
      {/* Status filter — hidden in kanban mode since status = columns */}
      {displayMode === "list" && (
        <div className="flex items-center gap-1">
          <span className="mr-1 text-dim text-w-sm">Status</span>
          <FilterBar options={STATUSES} value={statusFilter} onChange={onStatusChange} />
        </div>
      )}

      {displayMode === "list" && <div className="h-3 w-px bg-secondary" />}

      {/* Priority filter */}
      <div className="flex items-center gap-1">
        <span className="mr-1 text-dim text-w-sm">Priority</span>
        <FilterBar options={PRIORITIES} value={priorityFilter} onChange={onPriorityChange} />
      </div>
    </div>
  );
}
