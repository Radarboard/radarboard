"use client";

import { Button } from "@radarboard/ui/button";
import { Input } from "@radarboard/ui/input";
import { cn } from "@radarboard/utils/cn";
import { Plus, X } from "lucide-react";
import type React from "react";
import { useCallback, useState } from "react";
import type { Subtask } from "../types";

interface SubtaskListProps {
  subtasks: Subtask[];
  onToggle: (subtaskId: string) => void;
  onAdd: (title: string) => void;
  onRemove: (subtaskId: string) => void;
}

export function SubtaskList({ subtasks, onToggle, onAdd, onRemove }: SubtaskListProps) {
  const [newTitle, setNewTitle] = useState("");

  const handleAdd = useCallback(() => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setNewTitle("");
  }, [newTitle, onAdd]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAdd();
      }
    },
    [handleAdd]
  );

  const doneCount = subtasks.filter((s) => s.done).length;

  return (
    <div className="space-y-2">
      {/* Progress */}
      {subtasks.length > 0 && (
        <div className="text-dim text-w-sm">
          {doneCount}/{subtasks.length} done
        </div>
      )}

      {/* Subtask rows */}
      <div className="space-y-0.5">
        {subtasks.map((subtask) => (
          <div key={subtask.id} className="group flex items-center gap-2 py-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              uppercase={false}
              onClick={() => onToggle(subtask.id)}
              className={cn(
                "icon-base shrink-0 rounded-item border transition-colors",
                subtask.done
                  ? "border-emerald-500/50 bg-emerald-500/20"
                  : "border-border hover:border-foreground-secondary/30"
              )}
            >
              {Boolean(subtask.done) && (
                // biome-ignore lint/a11y/noSvgWithoutTitle: decorative checkmark
                <svg className="icon-base text-emerald-400" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M4 8l3 3 5-5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </Button>
            <span
              className={cn(
                "flex-1 text-sm",
                subtask.done ? "text-dim line-through" : "text-foreground-secondary"
              )}
            >
              {subtask.title}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              uppercase={false}
              onClick={() => onRemove(subtask.id)}
              className="shrink-0 rounded-item p-0.5 text-dim opacity-0 transition-all hover:text-red-400 group-hover:opacity-100"
            >
              <X className="icon-base" />
            </Button>
          </div>
        ))}
      </div>

      {/* Add subtask input */}
      <div className="flex items-center gap-2">
        <Plus className="icon-base text-dim" />
        <Input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add subtask..."
          variant="ghost"
          size="default"
          className="flex-1 text-foreground-secondary text-sm"
        />
      </div>
    </div>
  );
}
