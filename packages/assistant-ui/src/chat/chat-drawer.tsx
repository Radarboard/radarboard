"use client";

import { Button } from "@radarboard/ui/button";
import { Input } from "@radarboard/ui/input";
import { cn } from "@radarboard/utils/cn";
import { useHotkey } from "@tanstack/react-hotkeys";
import {
  CheckIcon,
  DownloadIcon,
  HelpCircleIcon,
  SearchIcon,
  Trash2Icon,
  XIcon,
  ZapIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ChatComposer } from "./chat-composer";
import { ChatProvider, useChatContext } from "./chat-context";
import { ChatMessages } from "./chat-messages";
import { ChatSearch } from "./chat-search";
import { ChatShortcuts } from "./chat-shortcuts";
import { ChatSidebar } from "./chat-sidebar";
import { ChatStatusline } from "./chat-statusline";
import { ChatTooltipButton } from "./chat-tooltip-button";
import { ConversationHeader } from "./chat-ui";
import { useChatDrawer } from "./use-chat-drawer";
import { useChatResize } from "./use-chat-resize";
import { useChatSidebar } from "./use-chat-sidebar";

const BRIEF_ME_PROMPT =
  "Give me a brief situational summary: what's the current revenue trend, any recent anomalies or Sentry issues, top open priorities, and what I should focus on next.";

/**
 * Slides in from the right, pushing dashboard content left.
 * Fully resizable via left-edge drag handle.
 * Thread sidebar is foldable and starts folded by default.
 */
export function ChatDrawer() {
  const { isOpen } = useChatDrawer();

  if (!isOpen) return null;

  return (
    <ChatProvider>
      <ChatDrawerInner />
    </ChatProvider>
  );
}

function ChatDrawerInner() {
  const { close } = useChatDrawer();
  const { width, isDragging, handleDragStart } = useChatResize();
  const { isSidebarOpen, toggleSidebar } = useChatSidebar();
  const { activeThreadId, threads, renameThread, session } = useChatContext();
  const drawerRef = useRef<HTMLElement>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const activeThread = threads.find((t) => t.id === activeThreadId);

  useEffect(() => {
    drawerRef.current?.focus();
  }, []);

  // Close drawer on Escape (when no overlay is open)
  useHotkey("Escape", () => {
    if (!showShortcuts && !showSearch) close();
  });
  // Toggle sidebar with ⌘B / Ctrl+B (matching VSCode convention)
  useHotkey("Mod+B", (e) => {
    e.preventDefault();
    toggleSidebar();
  });
  // Search with ⌘⇧F
  useHotkey("Mod+Shift+F", (e) => {
    e.preventDefault();
    setShowSearch((v) => !v);
  });
  // Shortcuts cheatsheet with Mod+/
  useHotkey("Mod+/", (e) => {
    e.preventDefault();
    setShowShortcuts(true);
  });

  const startEditTitle = () => {
    if (!activeThread) return;
    setTitleValue(activeThread.title);
    setIsEditingTitle(true);
    setTimeout(() => titleInputRef.current?.focus(), 0);
  };

  const commitTitle = async () => {
    if (activeThread && titleValue.trim()) {
      await renameThread(activeThread.id, titleValue.trim());
    }
    setIsEditingTitle(false);
  };

  const cancelTitle = () => setIsEditingTitle(false);

  const exportMarkdown = () => {
    const lines: string[] = [`# ${activeThread?.title ?? "Chat"}\n`];
    for (const msg of session.messages) {
      const role = msg.role === "user" ? "**You**" : "**Assistant**";
      const text = msg.parts
        .filter((p) => p.type === "text")
        .map((p) => (p as { type: "text"; text: string }).text)
        .join("");
      if (text) lines.push(`${role}\n\n${text}\n`);
    }
    const blob = new Blob([lines.join("\n---\n\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeThread?.title ?? "chat"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const briefMe = () => {
    session.sendMessage(BRIEF_ME_PROMPT);
  };

  const hasMessages = session.messages.length > 0;
  const isStreaming = session.status === "streaming" || session.status === "submitted";

  return (
    <aside
      ref={drawerRef}
      tabIndex={-1}
      aria-label="AI assistant"
      style={{ width: `${width}px` }}
      className={cn(
        "flex h-full shrink-0 flex-row border-border border-l bg-surface",
        isDragging && "select-none"
      )}
    >
      {/* Left-edge resize handle */}
      <div
        className="w-1 shrink-0 cursor-col-resize transition-colors hover:bg-accent/30 active:bg-accent/50"
        onMouseDown={handleDragStart}
        aria-hidden="true"
      />

      {/* Foldable thread sidebar */}
      {Boolean(isSidebarOpen) && <ChatSidebar />}

      {/* Main chat area */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <ConversationHeader>
          <ChatTooltipButton
            tooltip="⌘B / Ctrl+B"
            onClick={toggleSidebar}
            className="shrink-0 font-mono text-dim text-w-sm uppercase tracking-widest transition-colors hover:text-foreground-secondary"
            aria-label={isSidebarOpen ? "Hide chat list" : "Show chat list"}
          >
            {isSidebarOpen ? "Hide" : "Chats"}
          </ChatTooltipButton>

          {/* Thread title — click to rename, only visible when sidebar is hidden */}
          {!isSidebarOpen && activeThread && (
            <div className="flex min-w-0 flex-1 items-center justify-center">
              {isEditingTitle ? (
                <div className="flex w-full max-w-[300px] items-center gap-1">
                  <Input
                    ref={titleInputRef}
                    type="text"
                    value={titleValue}
                    onChange={(e) => setTitleValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        commitTitle().catch(() => {
                          /* fire-and-forget */
                        });
                      if (e.key === "Escape") cancelTitle();
                    }}
                    onBlur={() => {
                      commitTitle().catch(() => {
                        /* fire-and-forget */
                      });
                    }}
                    className="h-7 min-w-0 flex-1 rounded-none border-accent border-b border-none bg-transparent p-0 text-center font-mono text-foreground text-w-sm shadow-none outline-none focus-visible:ring-0"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={commitTitle}
                    className="icon-lg uppercase-none shrink-0 text-success hover:bg-transparent"
                    aria-label="Save"
                  >
                    <CheckIcon size={14} />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={cancelTitle}
                    className="icon-lg uppercase-none shrink-0 text-dim hover:bg-transparent"
                    aria-label="Cancel"
                  >
                    <XIcon size={14} />
                  </Button>
                </div>
              ) : (
                <ChatTooltipButton
                  tooltip="Click to rename"
                  onClick={startEditTitle}
                  className="max-w-full truncate font-mono text-dim text-w-sm transition-colors hover:text-foreground-secondary"
                >
                  {activeThread.title}
                </ChatTooltipButton>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex shrink-0 items-center gap-1.5">
            <ChatTooltipButton
              tooltip="Search messages (⌘⇧F)"
              onClick={() => setShowSearch((v) => !v)}
              aria-label="Search messages"
              className="p-1.5 text-dim transition-colors hover:text-foreground-secondary"
            >
              <SearchIcon size={16} />
            </ChatTooltipButton>
            <ChatTooltipButton
              tooltip="Brief me — situational summary"
              onClick={briefMe}
              aria-label="Brief me"
              disabled={isStreaming}
              className="p-1.5 text-dim transition-colors hover:text-accent disabled:opacity-30"
            >
              <ZapIcon size={16} />
            </ChatTooltipButton>
            {hasMessages && (
              <>
                <div className="h-4 w-[1px] bg-border/20" />
                <ChatTooltipButton
                  tooltip="Export as Markdown"
                  onClick={exportMarkdown}
                  aria-label="Export conversation"
                  className="p-1.5 text-dim transition-colors hover:text-foreground-secondary"
                >
                  <DownloadIcon size={16} />
                </ChatTooltipButton>
                <ChatTooltipButton
                  tooltip="Clear messages"
                  onClick={session.clearMessages}
                  aria-label="Clear conversation"
                  className="p-1.5 text-dim transition-colors hover:text-destructive"
                >
                  <Trash2Icon size={16} />
                </ChatTooltipButton>
              </>
            )}
            <div className="h-4 w-[1px] bg-border/20" />
            <ChatTooltipButton
              tooltip="Keyboard shortcuts (⌘/)"
              onClick={() => setShowShortcuts(true)}
              aria-label="Keyboard shortcuts"
              className="p-1.5 text-dim transition-colors hover:text-foreground-secondary"
            >
              <HelpCircleIcon size={16} />
            </ChatTooltipButton>
            <Button
              type="button"
              variant="ghost"
              onClick={close}
              className="uppercase-none h-auto p-1.5 font-mono text-dim text-w-sm uppercase tracking-widest transition-colors hover:text-foreground-secondary"
              aria-label="Close AI assistant"
            >
              Close
            </Button>
          </div>
        </ConversationHeader>

        <ChatMessages conversationId={activeThreadId} />
        <ChatStatusline />
        <ChatComposer conversationId={activeThreadId} />

        {/* Overlays */}
        {Boolean(showSearch) && <ChatSearch onClose={() => setShowSearch(false)} />}
        {Boolean(showShortcuts) && <ChatShortcuts onClose={() => setShowShortcuts(false)} />}
      </div>
    </aside>
  );
}
