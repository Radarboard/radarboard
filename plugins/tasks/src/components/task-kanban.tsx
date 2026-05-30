"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@radarboard/ui/button";
import { Input } from "@radarboard/ui/input";
import { cn } from "@radarboard/utils/cn";
import {
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Eye,
  EyeOff,
  MoreHorizontal,
  Pencil,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";
import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { KanbanColumn, Task, TaskStatus } from "../types";

/** Color palette for column accents */
const COLUMN_COLORS: Record<string, { icon: string; ring: string }> = {
  blue: { icon: "text-blue-400", ring: "border-blue-500/30" },
  green: { icon: "text-green-400", ring: "border-green-500/30" },
  red: { icon: "text-red-400", ring: "border-red-500/30" },
  orange: { icon: "text-orange-400", ring: "border-orange-500/30" },
  purple: { icon: "text-purple-400", ring: "border-purple-500/30" },
  yellow: { icon: "text-yellow-400", ring: "border-yellow-500/30" },
};

const STATUS_ICONS: Record<string, typeof Circle> = {
  todo: Circle,
  "in-progress": Clock,
  done: CheckCircle2,
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-500/20 text-red-400",
  high: "bg-orange-500/20 text-orange-400",
  medium: "bg-yellow-500/20 text-yellow-400",
  low: "bg-dim/20 text-dim",
};

const COLOR_OPTIONS = ["blue", "green", "red", "orange", "purple", "yellow"];

const COLOR_HEX: Record<string, string> = {
  blue: "#60a5fa",
  green: "#4ade80",
  red: "#f87171",
  orange: "#fb923c",
  purple: "#c084fc",
  yellow: "#facc15",
};

function getColorHex(color: string | undefined): string {
  return color ? (COLOR_HEX[color] ?? "#777") : "#777";
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TaskKanbanProps {
  tasks: Task[];
  columns: KanbanColumn[];
  onColumnsChange: (columns: KanbanColumn[]) => void;
  onStatusChange: (id: string, newStatus: TaskStatus) => void;
  onSelect: (task: Task) => void;
  activePomodoroTaskId?: string;
}

interface KanbanItem {
  id: string;
  column: string;
  task: Task;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function TaskKanban({
  tasks,
  columns,
  onColumnsChange,
  onStatusChange,
  onSelect,
  activePomodoroTaskId,
}: TaskKanbanProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const visibleColumns = useMemo(
    () => columns.filter((c) => c.visible).sort((a, b) => a.order - b.order),
    [columns]
  );

  // Map tasks to kanban items (exclude archived)
  const items = useMemo<KanbanItem[]>(
    () =>
      tasks
        .filter((t) => t.status !== "archived")
        .map((t) => ({ id: t.id, column: t.status, task: t })),
    [tasks]
  );

  const [localItems, setLocalItems] = useState<KanbanItem[] | null>(null);
  const displayItems = localItems ?? items;

  // Reset local state when tasks change externally
  useMemo(() => {
    setLocalItems(null);
  }, []);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const activeTask = useMemo(
    () => (activeId ? displayItems.find((i) => i.id === activeId)?.task : null),
    [activeId, displayItems]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return;

      const current = displayItems;
      const activeItem = current.find((i) => i.id === active.id);
      if (!activeItem) return;

      const overItem = current.find((i) => i.id === over.id);
      const overColumn = overItem?.column ?? visibleColumns.find((c) => c.id === over.id)?.id;
      if (!overColumn || activeItem.column === overColumn) return;

      const updated = current.map((i) => (i.id === active.id ? { ...i, column: overColumn } : i));
      setLocalItems(updated);
    },
    [displayItems, visibleColumns]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);

      const { active, over } = event;
      if (!over) {
        setLocalItems(null);
        return;
      }

      const current = displayItems;
      const activeItem = current.find((i) => i.id === active.id);
      if (!activeItem) return;

      // If column changed, update task status
      const originalTask = items.find((i) => i.id === active.id);
      if (originalTask && activeItem.column !== originalTask.column) {
        onStatusChange(active.id as string, activeItem.column as TaskStatus);
      }

      // Reorder within column
      if (over.id !== active.id) {
        const oldIndex = current.findIndex((i) => i.id === active.id);
        const newIndex = current.findIndex((i) => i.id === over.id);
        if (oldIndex >= 0 && newIndex >= 0) {
          setLocalItems(arrayMove(current, oldIndex, newIndex));
        }
      }

      requestAnimationFrame(() => setLocalItems(null));
    },
    [displayItems, items, onStatusChange]
  );

  return (
    <div className="flex h-full flex-col">
      {/* Column settings toggle */}
      <div className="flex items-center justify-end px-3 pt-2 pb-1">
        <Button
          type="button"
          onClick={() => setShowSettings(!showSettings)}
          variant={showSettings ? "secondary" : "ghost"}
          size="sm"
          uppercase={false}
          className={cn(showSettings ? "" : "text-dim hover:text-foreground-secondary")}
        >
          <Settings2 className="icon-base" />
          Columns
        </Button>
      </div>

      {/* Column settings panel */}
      {Boolean(showSettings) && (
        <ColumnSettings
          columns={columns}
          onChange={onColumnsChange}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Kanban board */}
      <DndContext
        collisionDetection={closestCenter}
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div data-kanban-board className="flex h-full min-w-0 gap-0 overflow-x-auto p-3">
          {visibleColumns.map((col, idx) => (
            <div key={col.id} className="flex min-w-0" style={{ flex: col.width ?? 1 }}>
              <KanbanColumnView
                column={col}
                items={displayItems.filter((i) => i.column === col.id)}
                onSelect={onSelect}
                activePomodoroTaskId={activePomodoroTaskId}
              />
              {idx < visibleColumns.length - 1 && (
                <ColumnResizeHandle
                  totalRatio={visibleColumns.reduce((sum, c) => sum + (c.width ?? 1), 0)}
                  onResize={(delta) => {
                    const leftCol = visibleColumns[idx];
                    const rightCol = visibleColumns[idx + 1];
                    if (!leftCol || !rightCol) return;
                    const leftWidth = leftCol.width ?? 1;
                    const rightWidth = rightCol.width ?? 1;
                    const total = leftWidth + rightWidth;
                    const newLeft = Math.max(0.3, leftWidth + delta);
                    const newRight = Math.max(0.3, total - newLeft);
                    onColumnsChange(
                      columns.map((c) => {
                        if (c.id === leftCol.id) return { ...c, width: newLeft };
                        if (c.id === rightCol.id) return { ...c, width: newRight };
                        return c;
                      })
                    );
                  }}
                />
              )}
            </div>
          ))}
        </div>

        {typeof window !== "undefined" &&
          createPortal(
            <DragOverlay>
              {activeTask ? (
                <div className="cursor-grabbing opacity-90">
                  <KanbanCardContent task={activeTask} isDragOverlay />
                </div>
              ) : null}
            </DragOverlay>,
            document.body
          )}
      </DndContext>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Column settings panel
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Resize handle between columns
// ---------------------------------------------------------------------------

function ColumnResizeHandle({
  onResize,
  totalRatio,
}: {
  onResize: (deltaRatio: number) => void;
  totalRatio: number;
}) {
  const handleRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      // Walk up to find the kanban board container (the flex parent of all columns)
      const board = handleRef.current?.closest("[data-kanban-board]");
      if (!board) return;
      const boardWidth = board.getBoundingClientRect().width;
      if (boardWidth <= 0) return;

      setIsDragging(true);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      let lastX = startX;

      function handleMove(ev: PointerEvent) {
        const dx = ev.clientX - lastX;
        if (Math.abs(dx) < 1) return;
        // Convert pixel movement to ratio units (total ratios ≈ column count)
        const deltaRatio = (dx / boardWidth) * totalRatio;
        onResize(deltaRatio);
        lastX = ev.clientX;
      }

      function handleUp() {
        setIsDragging(false);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
      }

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
    },
    [onResize, totalRatio]
  );

  return (
    <div
      ref={handleRef}
      onPointerDown={handlePointerDown}
      className={cn(
        "group flex w-3 shrink-0 cursor-col-resize items-center justify-center",
        isDragging && "bg-accent/10"
      )}
    >
      <div
        className={cn(
          "h-8 w-px rounded-full transition-colors",
          isDragging ? "bg-accent" : "bg-border group-hover:bg-foreground-secondary/30"
        )}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Column settings panel
// ---------------------------------------------------------------------------

function ColumnSettings({
  columns,
  onChange,
  onClose,
}: {
  columns: KanbanColumn[];
  onChange: (columns: KanbanColumn[]) => void;
  onClose: () => void;
}) {
  const [columnUi, setColumnUi] = useState({
    addLabel: "",
    editLabel: "",
    editingId: null as string | null,
    isAdding: false,
    menuId: null as string | null,
  });
  const { addLabel, editLabel, editingId, isAdding, menuId } = columnUi;

  const sorted = useMemo(() => [...columns].sort((a, b) => a.order - b.order), [columns]);

  const handleAdd = useCallback(() => {
    const trimmed = addLabel.trim();
    if (!trimmed) return;
    const maxOrder = columns.reduce((max, c) => Math.max(max, c.order), 0);
    const id = trimmed.toLowerCase().replace(/\s+/g, "-");
    onChange([...columns, { id, label: trimmed, visible: true, order: maxOrder + 1 }]);
    setColumnUi((current) => ({ ...current, addLabel: "", isAdding: false }));
  }, [addLabel, columns, onChange]);

  const handleRename = useCallback(
    (id: string) => {
      const trimmed = editLabel.trim();
      if (!trimmed) return;
      onChange(columns.map((c) => (c.id === id ? { ...c, label: trimmed } : c)));
      setColumnUi((current) => ({ ...current, editingId: null, editLabel: "" }));
    },
    [editLabel, columns, onChange]
  );

  const handleToggleVisibility = useCallback(
    (id: string) => {
      onChange(columns.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c)));
    },
    [columns, onChange]
  );

  const handleColorChange = useCallback(
    (id: string, color: string | undefined) => {
      onChange(columns.map((c) => (c.id === id ? { ...c, color } : c)));
      setColumnUi((current) => ({ ...current, menuId: null }));
    },
    [columns, onChange]
  );

  const handleDelete = useCallback(
    (id: string) => {
      // Only allow deleting custom columns (not built-in statuses)
      const builtIn = new Set(["todo", "in-progress", "done"]);
      if (builtIn.has(id)) return;
      onChange(columns.filter((c) => c.id !== id));
      setColumnUi((current) => ({ ...current, menuId: null }));
    },
    [columns, onChange]
  );

  const handleMoveUp = useCallback(
    (id: string) => {
      const idx = sorted.findIndex((c) => c.id === id);
      if (idx <= 0) return;
      const reordered = sorted.map((c, i) => {
        if (i === idx - 1) return { ...c, order: idx };
        if (i === idx) return { ...c, order: idx - 1 };
        return { ...c, order: i };
      });
      onChange(reordered);
    },
    [sorted, onChange]
  );

  const handleMoveDown = useCallback(
    (id: string) => {
      const idx = sorted.findIndex((c) => c.id === id);
      if (idx < 0 || idx >= sorted.length - 1) return;
      const reordered = sorted.map((c, i) => {
        if (i === idx) return { ...c, order: idx + 1 };
        if (i === idx + 1) return { ...c, order: idx };
        return { ...c, order: i };
      });
      onChange(reordered);
    },
    [sorted, onChange]
  );

  const builtIn = new Set(["todo", "in-progress", "done"]);

  return (
    <div className="mx-3 mb-2 overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex items-center justify-between border-border border-b px-3 py-2">
        <span className="font-mono text-foreground-secondary text-w-sm">Column Settings</span>
        <Button
          type="button"
          onClick={onClose}
          variant="ghost-link"
          uppercase={false}
          className="text-dim text-w-xs hover:text-foreground-secondary"
        >
          Done
        </Button>
      </div>

      <div className="divide-y divide-border">
        {sorted.map((col, idx) => (
          <ColumnSettingsRow
            key={col.id}
            col={col}
            idx={idx}
            total={sorted.length}
            isEditing={editingId === col.id}
            editLabel={editLabel}
            setEditLabel={(v: string) => setColumnUi((c) => ({ ...c, editLabel: v }))}
            isBuiltIn={builtIn.has(col.id)}
            menuOpen={menuId === col.id}
            onMoveUp={() => handleMoveUp(col.id)}
            onMoveDown={() => handleMoveDown(col.id)}
            onRename={() => handleRename(col.id)}
            onStartEdit={() => {
              setColumnUi((current) => ({
                ...current,
                editingId: col.id,
                editLabel: col.label,
              }));
            }}
            onCancelEdit={() => setColumnUi((current) => ({ ...current, editingId: null }))}
            onToggleVisibility={() => handleToggleVisibility(col.id)}
            onToggleMenu={() =>
              setColumnUi((current) => ({
                ...current,
                menuId: current.menuId === col.id ? null : col.id,
              }))
            }
            onColorChange={(color) => handleColorChange(col.id, color)}
            onDelete={() => handleDelete(col.id)}
            onCloseMenu={() => setColumnUi((current) => ({ ...current, menuId: null }))}
          />
        ))}
      </div>

      {/* Add column */}
      <div className="border-border border-t px-3 py-2">
        {isAdding ? (
          <div className="flex items-center gap-2">
            <Input
              type="text"
              value={addLabel}
              onChange={(e) => setColumnUi((c) => ({ ...c, addLabel: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") {
                  setColumnUi((current) => ({ ...current, isAdding: false, addLabel: "" }));
                }
              }}
              placeholder="Column name..."
              size="sm"
              className="flex-1 bg-secondary font-mono"
            />
            <Button
              type="button"
              onClick={handleAdd}
              variant="secondary"
              size="sm"
              uppercase={false}
            >
              Add
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            onClick={() => setColumnUi((current) => ({ ...current, isAdding: true }))}
            variant="ghost-link"
            uppercase={false}
            className="gap-1.5 text-dim text-w-sm hover:text-foreground-secondary"
          >
            <Plus className="icon-base" />
            Add column
          </Button>
        )}
      </div>
    </div>
  );
}

function ColumnSettingsRow({
  col,
  idx,
  total,
  isEditing,
  editLabel,
  setEditLabel,
  isBuiltIn,
  menuOpen,
  onMoveUp,
  onMoveDown,
  onRename,
  onStartEdit,
  onCancelEdit,
  onToggleVisibility,
  onToggleMenu,
  onColorChange,
  onDelete,
  onCloseMenu,
}: {
  col: KanbanColumn;
  idx: number;
  total: number;
  isEditing: boolean;
  editLabel: string;
  setEditLabel: (v: string) => void;
  isBuiltIn: boolean;
  menuOpen: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRename: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onToggleVisibility: () => void;
  onToggleMenu: () => void;
  onColorChange: (color: string | undefined) => void;
  onDelete: () => void;
  onCloseMenu: () => void;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <div className="flex flex-col gap-0.5">
        <Button
          type="button"
          onClick={onMoveUp}
          disabled={idx === 0}
          variant="ghost-link"
          size="xs"
          uppercase={false}
          className="text-dim leading-none hover:text-foreground-secondary disabled:opacity-20"
          aria-label="Move up"
        >
          ▲
        </Button>
        <Button
          type="button"
          onClick={onMoveDown}
          disabled={idx === total - 1}
          variant="ghost-link"
          size="xs"
          uppercase={false}
          className="text-dim leading-none hover:text-foreground-secondary disabled:opacity-20"
          aria-label="Move down"
        >
          ▼
        </Button>
      </div>

      <span
        className={cn(
          "inline-block h-2.5 w-2.5 shrink-0 rounded-full",
          col.color ? `bg-${col.color}-400` : "bg-dim"
        )}
        style={
          col.color
            ? { backgroundColor: `var(--color-${col.color}-400, ${getColorHex(col.color)})` }
            : undefined
        }
      />

      {isEditing ? (
        <Input
          type="text"
          value={editLabel}
          onChange={(e) => setEditLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onRename();
            if (e.key === "Escape") onCancelEdit();
          }}
          onBlur={onRename}
          size="sm"
          className="flex-1 bg-secondary font-mono"
        />
      ) : (
        <span
          className={cn(
            "flex-1 font-mono text-w-sm",
            col.visible ? "text-foreground-secondary" : "text-dim line-through"
          )}
        >
          {col.label}
        </span>
      )}

      <Button
        type="button"
        onClick={onToggleVisibility}
        variant="ghost"
        size="icon"
        uppercase={false}
        className="text-dim hover:text-foreground-secondary"
        aria-label={col.visible ? "Hide column" : "Show column"}
      >
        {col.visible ? <Eye className="icon-base" /> : <EyeOff className="icon-base" />}
      </Button>

      <div className="relative">
        <Button
          type="button"
          onClick={onToggleMenu}
          variant="ghost"
          size="icon"
          uppercase={false}
          className="text-dim hover:text-foreground-secondary"
          aria-label="Column options"
        >
          <MoreHorizontal className="icon-base" />
        </Button>

        {Boolean(menuOpen) && (
          <ColumnMenu
            isBuiltIn={isBuiltIn}
            onRename={() => {
              onStartEdit();
              onCloseMenu();
            }}
            onColorChange={onColorChange}
            onDelete={onDelete}
            onClose={onCloseMenu}
          />
        )}
      </div>
    </div>
  );
}

function ColumnMenu({
  isBuiltIn,
  onRename,
  onColorChange,
  onDelete,
  onClose,
}: {
  isBuiltIn: boolean;
  onRename: () => void;
  onColorChange: (color: string | undefined) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        onClick={onClose}
        className="fixed inset-0 z-10 h-full w-full rounded-none p-0 hover:bg-transparent"
        aria-label="Close column menu"
      />
      <div className="absolute top-full right-0 z-20 mt-1 min-w-[160px] rounded border border-border bg-surface-raised py-1 shadow-lg">
        <Button
          type="button"
          onClick={onRename}
          variant="ghost"
          uppercase={false}
          fullWidth
          className="h-auto justify-start gap-2 px-3 py-1.5 text-foreground-secondary text-w-sm"
        >
          <Pencil className="icon-base" /> Rename
        </Button>

        {/* Color picker */}
        <div className="px-3 py-1.5">
          <span className="text-dim text-w-xs">Color</span>
          <div className="mt-1 flex items-center gap-1">
            <Button
              type="button"
              onClick={() => onColorChange(undefined)}
              variant="ghost"
              size="icon-xs"
              uppercase={false}
              className="h-4 w-4 rounded-full border border-border bg-dim hover:ring-1 hover:ring-foreground-secondary/30"
              aria-label="No color"
            />
            {COLOR_OPTIONS.map((color) => (
              <Button
                key={color}
                type="button"
                onClick={() => onColorChange(color)}
                variant="ghost"
                size="icon-xs"
                uppercase={false}
                className="h-4 w-4 rounded-full border border-border hover:ring-1 hover:ring-foreground-secondary/30"
                style={{ backgroundColor: getColorHex(color) }}
                aria-label={color}
              />
            ))}
          </div>
        </div>

        {!isBuiltIn && (
          <Button
            type="button"
            onClick={onDelete}
            variant="ghost"
            uppercase={false}
            fullWidth
            className="h-auto justify-start gap-2 px-3 py-1.5 text-red-400 text-w-sm"
          >
            <Trash2 className="icon-base" /> Delete
          </Button>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Column view
// ---------------------------------------------------------------------------

function KanbanColumnView({
  column,
  items,
  onSelect,
  activePomodoroTaskId,
}: {
  column: KanbanColumn;
  items: KanbanItem[];
  onSelect: (task: Task) => void;
  activePomodoroTaskId?: string;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: column.id });
  const Icon = STATUS_ICONS[column.id] ?? Circle;
  const colorStyle = column.color ? COLUMN_COLORS[column.color] : undefined;
  const itemIds = useMemo(() => items.map((i) => i.id), [items]);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-border bg-surface/50 transition-colors",
        isOver && "border-foreground-secondary/30 bg-secondary/30"
      )}
    >
      {/* Column header */}
      <div className="flex shrink-0 items-center gap-2 border-border border-b px-3 py-2">
        <Icon className={cn("icon-xs", colorStyle?.icon ?? "text-dim")} />
        <span className="font-medium font-mono text-foreground-secondary text-w-sm">
          {column.label}
        </span>
        <span className="ml-auto text-dim text-w-xs tabular-nums">{items.length}</span>
      </div>

      {/* Cards */}
      <SortableContext items={itemIds}>
        <div className="scrollbar-thin flex-1 space-y-2 overflow-y-auto p-2">
          {items.length === 0 && (
            <div className="flex items-center justify-center py-8 text-dim text-w-sm">No tasks</div>
          )}
          {items.map((item) => (
            <KanbanCard
              key={item.id}
              task={item.task}
              onSelect={onSelect}
              isPomodoro={activePomodoroTaskId === item.id}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card — entire card is draggable
// ---------------------------------------------------------------------------

function KanbanCard({
  task,
  onSelect,
  isPomodoro,
}: {
  task: Task;
  onSelect: (task: Task) => void;
  isPomodoro?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transition, transform, isDragging } = useSortable({
    id: task.id,
  });

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
  };

  // Click opens detail; drag (>5px) initiates drag.
  // Both use the same element — MouseSensor's distance constraint distinguishes them.
  return (
    // biome-ignore lint/a11y/useSemanticElements: dnd-kit drag handle requires div, not button
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onSelect(task)}
      className={cn("cursor-grab active:cursor-grabbing", isDragging && "opacity-30")}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(task);
        }
      }}
    >
      <KanbanCardContent task={task} isPomodoro={isPomodoro} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card content (shared between card and drag overlay)
// ---------------------------------------------------------------------------

function KanbanCardContent({
  task,
  isDragOverlay,
  isPomodoro,
}: {
  task: Task;
  isDragOverlay?: boolean;
  isPomodoro?: boolean;
}) {
  const subtasksDone = task.subtasks.filter((s) => s.done).length;
  const subtasksTotal = task.subtasks.length;

  return (
    <div
      className={cn(
        "rounded-md border border-border bg-background p-2.5 text-w-sm transition-colors",
        isDragOverlay && "shadow-lg ring-2 ring-foreground-secondary/20",
        isPomodoro && "border-red-500/30",
        !isDragOverlay && "hover:border-foreground-secondary/20"
      )}
    >
      {/* Title */}
      <p
        className={cn(
          "font-mono text-foreground-secondary leading-snug",
          task.status === "done" && "line-through opacity-60"
        )}
      >
        {task.title}
      </p>

      {/* Meta row */}
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        {/* Priority */}
        <span
          className={cn(
            "rounded px-1.5 py-0.5 font-mono text-w-xs",
            PRIORITY_COLORS[task.priority]
          )}
        >
          {task.priority}
        </span>

        {/* Project chip */}
        {Boolean(task.projectId) && (
          <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-dim text-w-xs">
            {task.projectId}
          </span>
        )}

        {/* Due date */}
        {Boolean(task.dueDate) && (
          <span className="flex items-center gap-1 text-dim text-w-xs">
            <Calendar className="icon-base" />
            {task.dueDate}
          </span>
        )}

        {/* Subtasks */}
        {subtasksTotal > 0 && (
          <span className="text-dim text-w-xs tabular-nums">
            {subtasksDone}/{subtasksTotal}
          </span>
        )}
      </div>
    </div>
  );
}
