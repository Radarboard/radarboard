"use client";

import { FilterBar } from "@radarboard/plugin-sdk/components/filter-bar";
import {
  FormField,
  FormInput,
  PluginFormDialog,
} from "@radarboard/plugin-sdk/components/form-dialog";
import { useCallback, useState } from "react";
import type { TaskPriority } from "../types";

const PRIORITIES = [
  { value: "low" as const, label: "Low" },
  { value: "medium" as const, label: "Med" },
  { value: "high" as const, label: "High" },
  { value: "urgent" as const, label: "Urgent" },
];

interface TaskFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: {
    title: string;
    description?: string;
    priority?: TaskPriority;
    dueDate?: string;
    projectId?: string;
  }) => void;
}

export function TaskFormDialog({ open, onClose, onSubmit }: TaskFormProps) {
  const [formState, setFormState] = useState({
    description: "",
    dueDate: "",
    priority: "medium" as TaskPriority,
    projectId: "",
    title: "",
  });
  const { description, dueDate, priority, projectId, title } = formState;
  const attachTitleInputRef = useCallback((node: HTMLInputElement | null) => {
    node?.focus();
  }, []);

  const handleSubmit = useCallback(() => {
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      dueDate: dueDate || undefined,
      projectId: projectId.trim() || undefined,
    });
    setFormState({
      description: "",
      dueDate: "",
      priority: "medium",
      projectId: "",
      title: "",
    });
  }, [title, description, priority, dueDate, projectId, onSubmit]);

  return (
    <PluginFormDialog
      open={open}
      onClose={onClose}
      title="New Task"
      onSubmit={handleSubmit}
      submitLabel="Add Task"
      submitDisabled={!title.trim()}
    >
      <FormField label="Title">
        <FormInput
          ref={attachTitleInputRef}
          value={title}
          onChange={(e) => setFormState((current) => ({ ...current, title: e.target.value }))}
          placeholder="Task title..."
        />
      </FormField>
      <FormField label="Description">
        <FormInput
          value={description}
          onChange={(e) => setFormState((current) => ({ ...current, description: e.target.value }))}
          placeholder="Optional description..."
        />
      </FormField>
      <FormField label="Priority">
        <FilterBar
          options={PRIORITIES}
          value={priority}
          onChange={(value) => setFormState((current) => ({ ...current, priority: value }))}
          size="md"
        />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Due Date">
          <FormInput
            type="date"
            value={dueDate}
            onChange={(e) => setFormState((current) => ({ ...current, dueDate: e.target.value }))}
            className="[color-scheme:dark]"
          />
        </FormField>
        <FormField label="Project">
          <FormInput
            value={projectId}
            onChange={(e) => setFormState((current) => ({ ...current, projectId: e.target.value }))}
            placeholder="Project slug..."
          />
        </FormField>
      </div>
    </PluginFormDialog>
  );
}
