"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ALL_PROJECTS_SLUG } from "@radarboard/types/dashboard";
import type { Project } from "@radarboard/types/project";
import { Badge } from "@radarboard/ui/badge";
import { Button } from "@radarboard/ui/button";
import { Input } from "@radarboard/ui/input";
import { cn } from "@radarboard/utils/cn";
import { ChevronDown, ChevronUp, GripVertical, LayoutGrid, Trash2 } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { CollapsibleListPanel, ListPanelHeader } from "../settings-list-panel";

const PROJECT_COLOR_PALETTE: readonly [string, ...string[]] = [
  "#5b8af5",
  "#e05555",
  "#4ade80",
  "#f5c542",
  "#b388ff",
  "#2fd4f7",
  "#f6b65b",
  "#ff8891",
];

function getNextProjectColor(projectColors: string[]): string {
  const fallbackColor = PROJECT_COLOR_PALETTE[0];
  const usedColors = new Set(
    projectColors
      .map((color) => color.trim().toLowerCase())
      .filter((color) => /^#[0-9a-f]{6}$/i.test(color))
  );

  const unusedColor = PROJECT_COLOR_PALETTE.find((color) => !usedColors.has(color.toLowerCase()));
  if (unusedColor) return unusedColor;
  return (
    PROJECT_COLOR_PALETTE[projectColors.length % PROJECT_COLOR_PALETTE.length] ?? fallbackColor
  );
}

// ---------------------------------------------------------------------------
// NewProjectForm
// ---------------------------------------------------------------------------

function NewProjectForm({
  projectColors,
  onAdd,
  onCancel,
}: {
  projectColors: string[];
  onAdd: (name: string, color: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(() => getNextProjectColor(projectColors));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd(name.trim(), color);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-1 space-y-2 rounded-item border border-border bg-secondary p-3"
    >
      <div className="flex items-center gap-2">
        <label className="relative shrink-0 cursor-pointer">
          <span
            className="icon-sm block rounded-full border border-border"
            style={{ backgroundColor: color }}
          />
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label="Project color"
          />
        </label>

        <Input
          type="text"
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Project name…"
          className="flex-1 p-0 focus-visible:border-accent focus-visible:border-b"
          variant="ghost"
          size="default"
          rounded-item="none"
        />
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="submit"
          disabled={!name.trim()}
          size="sm"
          uppercase={false}
          className="h-auto px-3 py-1 font-mono text-w-sm"
        >
          Create
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          uppercase={false}
          className="h-auto px-3 py-1 font-mono text-dim text-w-sm hover:text-muted-foreground"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// SortableProjectRow
// ---------------------------------------------------------------------------

function SortableProjectRow({
  project,
  index,
  total,
  isSelected,
  isUserCreated,
  onSelect,
  onMoveUp,
  onMoveDown,
  onDelete,
}: {
  project: Project;
  index: number;
  total: number;
  isSelected: boolean;
  isUserCreated: boolean;
  onSelect: () => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onDelete: (() => void) | undefined;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: project.slug,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        borderLeftColor: isSelected ? project.color : undefined,
      }}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-item border px-3 py-3 transition-colors",
        isDragging && "opacity-50",
        isSelected
          ? "border-accent/20 border-l-2 bg-accent/5"
          : "border-border bg-surface hover:bg-surface-raised"
      )}
      tabIndex={0}
      role="option"
      aria-selected={isSelected}
      aria-roledescription="sortable item"
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        uppercase={false}
        className="h-7 w-7 shrink-0 cursor-grab touch-none p-0 text-dim hover:bg-transparent hover:text-muted-foreground active:cursor-grabbing"
        aria-label={`Drag to reorder ${project.name}`}
        onClick={(e) => e.stopPropagation()}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="icon-sm" />
      </Button>

      <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: project.color }} />

      <span
        className={cn(
          "flex-1 truncate font-mono text-w-sm uppercase tracking-wider",
          isSelected ? "text-foreground" : "text-dim"
        )}
      >
        {project.name}
      </span>

      <div
        role="none"
        className="flex shrink-0 items-center gap-0.5"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") e.stopPropagation();
        }}
      >
        {Boolean(isUserCreated) && onDelete && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            uppercase={false}
            className="icon-lg p-0.5 text-dim transition-colors hover:text-destructive"
            aria-label={`Delete ${project.name}`}
          >
            <Trash2 className="icon-xs" />
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onMoveUp(index);
          }}
          disabled={index === 0}
          aria-label={`Move ${project.name} up`}
          uppercase={false}
          className="icon-lg p-0.5 text-dim hover:text-muted-foreground disabled:opacity-20"
        >
          <ChevronUp className="icon-xs" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onMoveDown(index);
          }}
          disabled={index === total - 1}
          aria-label={`Move ${project.name} down`}
          uppercase={false}
          className="icon-lg p-0.5 text-dim hover:text-muted-foreground disabled:opacity-20"
        >
          <ChevronDown className="icon-xs" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AllProjectRow
// ---------------------------------------------------------------------------

function AllProjectRow({ isSelected, onSelect }: { isSelected: boolean; onSelect: () => void }) {
  return (
    <div className="mb-3">
      <Button
        type="button"
        variant="ghost"
        onClick={onSelect}
        fullWidth
        uppercase={false}
        className={cn(
          "flex h-auto items-center justify-start gap-2.5 rounded-item border-l-2 px-3 py-2.5 font-sans transition-colors",
          isSelected
            ? "border-l-accent bg-accent/10 text-foreground"
            : "border-l-transparent bg-surface text-foreground-secondary hover:border-l-accent/40 hover:bg-surface-raised"
        )}
        role="option"
        aria-selected={isSelected}
      >
        <LayoutGrid
          className={cn("icon-xs shrink-0", isSelected ? "text-accent" : "text-accent/60")}
        />
        <span className="flex-1 text-left font-mono text-w-xs uppercase tracking-wider">
          All Projects
        </span>
        <Badge className="border-none bg-accent/10 text-accent/70">aggregate</Badge>
      </Button>
      <div className="mt-2 mb-1 border-border border-t border-dashed" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProjectListPanel
// ---------------------------------------------------------------------------

interface ProjectListPanelProps {
  filteredProjects: Project[];
  orderedProjects: Project[];
  selectedSlug: string | null;
  userProjectSlugSet: Set<string>;
  showNewProjectForm: boolean;
  projectSearch: string;
  onSearchChange: (value: string) => void;
  onShowNewProjectForm: () => void;
  onCreateProject: (name: string, color: string) => void;
  onCancelNewProject: () => void;
  onSelectSlug: (slug: string) => void;
  onOrderChange: (newOrder: string[]) => void;
  onDeleteProject: (slug: string) => void;
}

export function ProjectListPanel({
  filteredProjects,
  orderedProjects,
  selectedSlug,
  userProjectSlugSet,
  showNewProjectForm,
  projectSearch,
  onSearchChange,
  onShowNewProjectForm,
  onCreateProject,
  onCancelNewProject,
  onSelectSlug,
  onOrderChange,
  onDeleteProject,
}: ProjectListPanelProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedProjects.findIndex((p) => p.slug === active.id);
    const newIndex = orderedProjects.findIndex((p) => p.slug === over.id);
    onOrderChange(arrayMove(orderedProjects, oldIndex, newIndex).map((p) => p.slug));
  }

  function handleMoveUp(index: number) {
    if (index === 0) return;
    onOrderChange(arrayMove(orderedProjects, index, index - 1).map((p) => p.slug));
  }

  function handleMoveDown(index: number) {
    if (index === orderedProjects.length - 1) return;
    onOrderChange(arrayMove(orderedProjects, index, index + 1).map((p) => p.slug));
  }

  return (
    <CollapsibleListPanel className="overflow-hidden">
      <ListPanelHeader
        title="Projects"
        subtitle="Click to configure. Drag to reorder."
        searchPlaceholder="Search projects…"
        searchValue={projectSearch}
        onSearchChange={onSearchChange}
        onAdd={onShowNewProjectForm}
        addLabel="Add new project"
      />

      <div className="shrink-0 px-3 pt-3 pb-0">
        <AllProjectRow
          isSelected={selectedSlug === ALL_PROJECTS_SLUG}
          onSelect={() => onSelectSlug(ALL_PROJECTS_SLUG)}
        />
      </div>

      <div className="scrollbar-thin flex-1 overflow-y-auto p-3 pt-0">
        {Boolean(showNewProjectForm) && (
          <NewProjectForm
            projectColors={orderedProjects.map((project) => project.color)}
            onAdd={onCreateProject}
            onCancel={onCancelNewProject}
          />
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={filteredProjects.map((p) => p.slug)}
            strategy={verticalListSortingStrategy}
          >
            <div role="listbox" aria-label="Project list" className="flex flex-col gap-1">
              {filteredProjects.map((project, index) => (
                <SortableProjectRow
                  key={project.slug}
                  project={project}
                  index={index}
                  total={filteredProjects.length}
                  isSelected={selectedSlug === project.slug}
                  isUserCreated={userProjectSlugSet.has(project.slug)}
                  onSelect={() => onSelectSlug(project.slug)}
                  onMoveUp={handleMoveUp}
                  onMoveDown={handleMoveDown}
                  onDelete={
                    userProjectSlugSet.has(project.slug)
                      ? () => onDeleteProject(project.slug)
                      : undefined
                  }
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </CollapsibleListPanel>
  );
}
