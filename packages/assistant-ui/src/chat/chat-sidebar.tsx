"use client";

import { Button } from "@radarboard/ui/button";
import { Input } from "@radarboard/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@radarboard/ui/tooltip";
import { cn } from "@radarboard/utils/cn";
import {
  CheckIcon,
  MessageSquareIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useChatContext } from "./chat-context";

/**
 * Thread list sidebar. Double-click a title to rename inline.
 */
export function ChatSidebar() {
  const { threads, activeThreadId, selectThread, createThread, renameThread, deleteThread } =
    useChatContext();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredThreads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) => t.title.toLowerCase().includes(q));
  }, [threads, searchQuery]);

  const startRename = useCallback((id: string, currentTitle: string) => {
    setEditingId(id);
    setEditValue(currentTitle);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const commitRename = useCallback(async () => {
    if (!editingId || !editValue.trim()) {
      setEditingId(null);
      return;
    }
    await renameThread(editingId, editValue.trim());
    setEditingId(null);
  }, [editingId, editValue, renameThread]);

  const cancelRename = useCallback(() => {
    setEditingId(null);
  }, []);

  return (
    <div className="flex w-[160px] shrink-0 flex-col overflow-hidden border-border border-r bg-surface">
      <Button
        type="button"
        variant="ghost"
        onClick={createThread}
        className="uppercase-none flex h-auto items-center justify-start gap-1.5 rounded-none border-border border-b px-3 py-2.5 font-mono text-dim text-w-sm uppercase tracking-widest transition-colors hover:text-foreground-secondary"
      >
        <PlusIcon size={12} />
        New chat
      </Button>

      {/* Search */}
      <div className="flex items-center gap-1.5 border-border border-b px-3 py-1.5">
        <SearchIcon size={10} className="shrink-0 text-dim" />
        <Input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter…"
          className="h-6 min-w-0 flex-1 rounded-none border-none bg-transparent p-0 font-mono text-foreground text-w-sm shadow-none outline-none placeholder:text-muted-foreground focus-visible:ring-0"
        />
        {Boolean(searchQuery) && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setSearchQuery("")}
            className="icon-sm uppercase-none shrink-0 p-0 text-dim hover:bg-transparent hover:text-dim"
            aria-label="Clear search"
          >
            <XIcon size={9} />
          </Button>
        )}
      </div>

      <div className="scrollbar-thin flex-1 overflow-y-auto">
        {filteredThreads.length === 0 && (
          <p className="px-3 py-3 font-mono text-dim text-w-sm">
            {searchQuery ? "No matches" : "No chats yet"}
          </p>
        )}
        {filteredThreads.map((thread) => (
          <div
            key={thread.id}
            className={cn(
              "group relative flex items-start gap-1.5 px-3 py-2 font-mono text-w-sm transition-colors",
              thread.id === activeThreadId
                ? "bg-accent/10 text-foreground"
                : "text-dim hover:bg-muted hover:text-foreground-secondary"
            )}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => selectThread(thread.id)}
              className="uppercase-none mt-0.5 h-auto w-auto shrink-0 p-0 text-inherit hover:bg-transparent"
              aria-label={`Select ${thread.title}`}
            >
              <MessageSquareIcon size={11} />
            </Button>

            {editingId === thread.id ? (
              /* Inline rename input */
              <div className="flex min-w-0 flex-1 items-center gap-1">
                <Input
                  ref={inputRef}
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      commitRename().catch(() => {
                        /* fire-and-forget */
                      });
                    if (e.key === "Escape") cancelRename();
                  }}
                  onBlur={() => {
                    commitRename().catch(() => {
                      /* fire-and-forget */
                    });
                  }}
                  className="h-5 min-w-0 flex-1 rounded-none border-accent border-b border-none bg-transparent p-0 py-0 font-mono text-foreground text-w-sm shadow-none outline-none focus-visible:ring-0"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={commitRename}
                  className="icon-sm uppercase-none shrink-0 p-0 text-success hover:bg-transparent"
                  aria-label="Save"
                >
                  <CheckIcon size={10} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={cancelRename}
                  className="icon-sm uppercase-none shrink-0 p-0 text-dim hover:bg-transparent"
                  aria-label="Cancel"
                >
                  <XIcon size={10} />
                </Button>
              </div>
            ) : (
              /* Normal title — click to select; action icons overlay on hover */
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="uppercase-none h-auto flex-1 truncate p-0 text-left font-normal text-inherit leading-tight hover:bg-transparent"
                    onClick={() => selectThread(thread.id)}
                  >
                    {thread.title}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">{thread.title}</TooltipContent>
              </Tooltip>
            )}

            {editingId !== thread.id && (
              <div className="absolute top-1/2 right-1 hidden -translate-y-1/2 items-center gap-0.5 bg-inherit group-hover:flex">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => startRename(thread.id, thread.title)}
                  aria-label="Rename conversation"
                  className="icon-sm uppercase-none flex shrink-0 items-center p-0 text-dim transition-colors hover:bg-transparent hover:text-dim"
                >
                  <PencilIcon size={9} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Delete conversation"
                  onClick={() => deleteThread(thread.id)}
                  className="icon-sm uppercase-none flex shrink-0 items-center p-0 text-dim transition-colors hover:bg-transparent hover:text-destructive"
                >
                  <Trash2Icon size={10} />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
