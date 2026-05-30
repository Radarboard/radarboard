"use client";

import { formatRelativeTime } from "@radarboard/plugin-sdk/utils";
import { Button } from "@radarboard/ui/button";
import { Input } from "@radarboard/ui/input";
import type { RichTextComposerHandle } from "@radarboard/ui/rich-text-composer";
import { RichTextComposer } from "@radarboard/ui/rich-text-composer";
import { RichTextViewer } from "@radarboard/ui/rich-text-viewer";
import { NativeSelect } from "@radarboard/ui/select";
import { Textarea } from "@radarboard/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@radarboard/ui/tooltip";
import { cn } from "@radarboard/utils/cn";
import { Archive, Clock, Eye, FileText, Pen, RotateCcw, Star, Trash2, Type } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { type SaveStatus, useAutoSave } from "../hooks/use-auto-save";
import type { Note, NoteFolder } from "../types";

type EditorMode = "rich" | "markdown" | "preview";

interface NoteEditorProps {
  note: Note;
  folders: NoteFolder[];
  onUpdate: (
    id: string,
    changes: Partial<Pick<Note, "title" | "content" | "tags" | "folderId">>
  ) => Promise<void>;
  onPin: (id: string) => Promise<void>;
  onArchive: (id: string) => Promise<void>;
  onTrash: (id: string) => Promise<void>;
  onRestore: (id: string) => Promise<void>;
  onPermanentDelete: (id: string) => Promise<void>;
  onMoveToFolder: (id: string, folderId: string | undefined) => Promise<void>;
  onShowHistory?: (noteId: string) => void;
  onCreateSnapshot?: (noteId: string, title: string, content: string) => void;
}

export function NoteEditor({
  note,
  folders,
  onUpdate,
  onPin,
  onArchive,
  onTrash,
  onRestore,
  onPermanentDelete,
  onMoveToFolder,
  onShowHistory,
  onCreateSnapshot,
}: NoteEditorProps) {
  const [editorState, setEditorState] = useState(() => ({
    content: note.content,
    mode: "rich" as EditorMode,
    tagsInput: note.tags.join(", "),
    title: note.title,
  }));
  const { content, mode, tagsInput, title } = editorState;
  const composerRef = useRef<RichTextComposerHandle>(null);

  const autoSave = useAutoSave({
    delay: 1500,
    onSave: async (value) => {
      // Parse what changed: value is content, but we also check title/tags
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      await onUpdate(note.id, {
        title: title.trim() || "Untitled",
        content: value,
        tags: tags.length > 0 ? tags : [],
      });
    },
    onBeforeFirstSave: () => {
      onCreateSnapshot?.(note.id, note.title, note.content);
    },
  });

  // Reset state when switching notes
  useEffect(() => {
    setEditorState({
      content: note.content,
      mode: "rich",
      tagsInput: note.tags.join(", "),
      title: note.title,
    });
    autoSave.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSave.reset, note.content, note.tags.join, note.title]);

  const handleContentChange = useCallback(
    (markdown: string) => {
      setEditorState((current) => ({ ...current, content: markdown }));
      autoSave.handleChange(markdown);
    },
    [autoSave]
  );

  const handleTitleBlur = useCallback(() => {
    if (title.trim() !== note.title) {
      autoSave.handleChange(content);
    }
  }, [title, note.title, content, autoSave]);

  const handleTagsBlur = useCallback(() => {
    const newTags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const oldTags = note.tags.join(",");
    const newTagsStr = newTags.join(",");
    if (oldTags !== newTagsStr) {
      autoSave.handleChange(content);
    }
  }, [tagsInput, note.tags, content, autoSave]);

  // Switch modes — flush and sync content
  const handleModeSwitch = useCallback(
    (newMode: EditorMode) => {
      autoSave.flush();

      if (mode === "rich" && newMode !== "rich") {
        const markdown = composerRef.current?.getMarkdown() ?? content;
        setEditorState((current) => ({
          ...current,
          content: markdown,
          mode: newMode,
        }));
        return;
      }

      setEditorState((current) => ({
        ...current,
        mode: newMode,
      }));
    },
    [mode, content, autoSave]
  );

  const isReadOnly = note.status !== "active";

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-border border-b px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {isReadOnly ? (
              <h2 className="text-foreground-secondary text-w-xl leading-tight">{note.title}</h2>
            ) : (
              <Input
                type="text"
                value={title}
                onChange={(e) =>
                  setEditorState((current) => ({ ...current, title: e.target.value }))
                }
                onBlur={handleTitleBlur}
                variant="ghost"
                size="xl"
                className="w-full text-foreground-secondary text-w-xl leading-tight"
                placeholder="Note title..."
              />
            )}
            <div className="mt-1 flex items-center gap-3 font-mono text-dim text-w-sm">
              <span>{formatRelativeTime(note.updatedAt)}</span>
              <span>{note.wordCount} words</span>
              <SaveStatusBadge status={autoSave.status} />
            </div>
          </div>

          <div className="flex items-center gap-1">
            {note.status === "active" && (
              <>
                <IconButton
                  icon={
                    <Star
                      className={cn("icon-base", note.pinned && "fill-amber-400 text-amber-400")}
                    />
                  }
                  label={note.pinned ? "Unpin" : "Pin"}
                  onClick={() => onPin(note.id)}
                />
                {Boolean(onShowHistory) && (
                  <IconButton
                    icon={<Clock className="icon-base" />}
                    label="History"
                    onClick={() => onShowHistory?.(note.id)}
                  />
                )}
                <IconButton
                  icon={<Archive className="icon-base" />}
                  label="Archive"
                  onClick={() => onArchive(note.id)}
                />
                <IconButton
                  icon={<Trash2 className="icon-base" />}
                  label="Trash"
                  onClick={() => onTrash(note.id)}
                  danger
                />
              </>
            )}
            {note.status === "trashed" && (
              <>
                <IconButton
                  icon={<RotateCcw className="icon-base" />}
                  label="Restore"
                  onClick={() => onRestore(note.id)}
                />
                <IconButton
                  icon={<Trash2 className="icon-base" />}
                  label="Delete forever"
                  onClick={() => onPermanentDelete(note.id)}
                  danger
                />
              </>
            )}
            {note.status === "archived" && (
              <IconButton
                icon={<RotateCcw className="icon-base" />}
                label="Restore"
                onClick={() => onRestore(note.id)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Mode toggle + folder */}
      <div className="flex items-center justify-between gap-2 border-border border-b px-4 py-2">
        <div className="flex items-center gap-1 rounded bg-secondary p-0.5">
          <ModeTab
            active={mode === "rich"}
            onClick={() => handleModeSwitch("rich")}
            disabled={isReadOnly}
          >
            <Pen className="icon-base" />
            <span>Rich</span>
          </ModeTab>
          <ModeTab
            active={mode === "markdown"}
            onClick={() => handleModeSwitch("markdown")}
            disabled={isReadOnly}
          >
            <Type className="icon-base" />
            <span>Markdown</span>
          </ModeTab>
          <ModeTab active={mode === "preview"} onClick={() => handleModeSwitch("preview")}>
            <Eye className="icon-base" />
            <span>Preview</span>
          </ModeTab>
        </div>

        {/* Folder select */}
        {note.status === "active" && (
          <NativeSelect
            value={note.folderId ?? ""}
            onChange={(e) => onMoveToFolder(note.id, e.target.value || undefined)}
            variant="default"
            size="sm"
            className="w-auto bg-secondary"
          >
            <option value="">Inbox</option>
            {folders
              .filter((f) => !f.archived)
              .map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
          </NativeSelect>
        )}
      </div>

      {/* Editor area */}
      <div className="scrollbar-thin flex-1 overflow-y-auto overflow-x-hidden">
        {mode === "rich" && !isReadOnly && (
          <RichTextComposer
            ref={composerRef}
            value={content}
            onChange={(markdown) => handleContentChange(markdown)}
            placeholder="Start writing..."
            className="border-0 bg-transparent"
            editorClassName="min-h-[300px] px-4 py-3 text-sm text-foreground-secondary prose prose-invert max-w-none"
            disabled={isReadOnly}
          />
        )}

        {mode === "markdown" && !isReadOnly && (
          <Textarea
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            className="h-full min-h-[300px] resize-none border-0 bg-transparent px-4 py-3 font-mono text-foreground-secondary text-sm"
            placeholder="Write markdown..."
            spellCheck={false}
          />
        )}

        {(mode === "preview" || isReadOnly) && (
          <div className="px-4 py-3">
            {content ? (
              <RichTextViewer markdown={content} className="text-sm" />
            ) : (
              <div className="text-dim text-sm italic">No content yet.</div>
            )}
          </div>
        )}
      </div>

      {/* Footer: tags */}
      {note.status === "active" && (
        <div className="flex items-center gap-2 border-border border-t px-4 py-2">
          <FileText className="icon-xs shrink-0 text-dim" />
          <Input
            type="text"
            value={tagsInput}
            onChange={(e) =>
              setEditorState((current) => ({ ...current, tagsInput: e.target.value }))
            }
            onBlur={handleTagsBlur}
            placeholder="Tags (comma-separated)..."
            variant="ghost"
            size="default"
            className="flex-1 font-mono text-dim text-w-sm"
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ModeTab({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      variant={active ? "secondary" : "ghost"}
      uppercase={false}
      className={cn(
        "gap-1.5 px-2.5 py-1 font-mono text-w-base",
        active
          ? "bg-surface text-foreground-secondary shadow-sm"
          : "text-dim hover:text-foreground-secondary",
        disabled && "cursor-not-allowed opacity-40"
      )}
    >
      {children}
    </Button>
  );
}

function IconButton({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  const button = (
    <Button
      type="button"
      onClick={onClick}
      variant="ghost"
      size="icon"
      uppercase={false}
      className={cn(
        danger
          ? "text-dim hover:bg-red-400/10 hover:text-red-400"
          : "text-dim hover:bg-secondary hover:text-foreground-secondary"
      )}
      aria-label={label}
    >
      {icon}
    </Button>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function SaveStatusBadge({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  return (
    <span
      className={cn(
        "font-mono text-w-xs",
        status === "saving" && "text-blue-400",
        status === "saved" && "text-emerald-400",
        status === "error" && "text-red-400"
      )}
    >
      {status === "saving" && "Saving..."}
      {status === "saved" && "Saved"}
      {status === "error" && "Save failed"}
    </span>
  );
}
