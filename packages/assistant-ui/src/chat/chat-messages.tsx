"use client";

import type { LlmMessagePart } from "@radarboard/llm/types";
import { API_ROUTES } from "@radarboard/types/api-routes";
import { Button } from "@radarboard/ui/button";
import { Input } from "@radarboard/ui/input";
import { Textarea } from "@radarboard/ui/textarea";
import { cn } from "@radarboard/utils/cn";
import {
  BotIcon,
  BrainIcon,
  CheckIcon,
  ClipboardListIcon,
  CopyIcon,
  Loader2Icon,
  PencilIcon,
  RefreshCwIcon,
  SquareIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  XIcon,
} from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import type { RefObject } from "react";
import {
  Fragment,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useChatContext } from "./chat-context";
import { ChatMarkdown } from "./chat-markdown";
import {
  FEEDBACK_REASON_TAGS,
  type FeedbackReasonTag,
  getFeedback,
  patchFeedbackDown,
  persistResponseFeedbackVote,
} from "./chat-response-feedback-storage";
import { submitChatResponseFeedbackToServer } from "./chat-response-feedback-sync";
import { ChatTooltipButton } from "./chat-tooltip-button";
import {
  Checkpoint,
  Conversation,
  ConversationContent,
  ConversationMessages,
  ConversationScrollButton,
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  Reasoning,
  SuggestedAction,
  SuggestedActions,
} from "./chat-ui";
import { useChatDrawer } from "./use-chat-drawer";

// ---------------------------------------------------------------------------
// MessageItem — extracted to keep ChatMessages complexity within lint limits
// ---------------------------------------------------------------------------

import type { LlmMessage } from "@radarboard/llm/types";

interface ToolAction {
  openLabel: string;
  openUrl: string;
  pluginId: string | null;
}

const AT_BOTTOM_THRESHOLD_PX = 4;
const STICK_TO_BOTTOM_THRESHOLD_PX = 40;

function classifyAssistantError(message: string): "network" | "policy" | "rate_limit" | "unknown" {
  const m = message.toLowerCase();
  if (m.includes("429") || m.includes("rate limit") || m.includes("too many requests"))
    return "rate_limit";
  if (
    m.includes("network") ||
    m.includes("fetch") ||
    m.includes("timeout") ||
    m.includes("econn") ||
    m.includes("failed to fetch")
  )
    return "network";
  if (
    m.includes("policy") ||
    m.includes("safety") ||
    m.includes("content filter") ||
    m.includes("blocked")
  )
    return "policy";
  return "unknown";
}

function assistantErrorHint(kind: ReturnType<typeof classifyAssistantError>): string {
  switch (kind) {
    case "rate_limit":
      return "Wait a moment, then try again or switch model in the status bar.";
    case "network":
      return "Check your connection. You can retry without retyping your last message.";
    case "policy":
      return "Rephrase your request or remove sensitive content, then try again.";
    default:
      return "Your last prompt is still in the composer so you can edit and resend.";
  }
}

function extractToolAction(result: unknown): ToolAction | null {
  if (!result || typeof result !== "object") return null;
  const openLabel =
    "openLabel" in result && typeof result.openLabel === "string" ? result.openLabel : null;
  const openUrl = "openUrl" in result && typeof result.openUrl === "string" ? result.openUrl : null;
  const pluginId =
    "pluginId" in result && typeof result.pluginId === "string" ? result.pluginId : null;
  if (!openLabel || !openUrl) return null;
  return { openLabel, openUrl, pluginId };
}

function extractPluginIdFromUrl(openUrl: string): string | null {
  try {
    const url = new URL(openUrl, "https://radarboard.local");
    return url.searchParams.get("plugin");
  } catch {
    return null;
  }
}

function resolvePluginIdForAction(action: ToolAction): string | null {
  return action.pluginId ?? extractPluginIdFromUrl(action.openUrl);
}

function extractPluginIdFromEventTarget(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  const anchor = target.closest("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  return extractPluginIdFromUrl(anchor.getAttribute("href") ?? anchor.href);
}

function useMessageSelection(messages: LlmMessage[]) {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const clearSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const copySelected = useCallback(() => {
    const lines: string[] = [];
    for (const msg of messages) {
      if (!selectedIds.has(msg.id)) continue;
      const role = msg.role === "user" ? "You" : "Assistant";
      const text = msg.parts
        .filter((part) => part.type === "text")
        .map((part) => (part as { type: "text"; text: string }).text)
        .join("");
      if (text) lines.push(`${role}: ${text}`);
    }
    import("@radarboard/utils/clipboard")
      .then(({ copyText }) => copyText(lines.join("\n\n")))
      .then(() => clearSelection());
  }, [clearSelection, messages, selectedIds]);

  const exportSelected = useCallback(() => {
    const lines: string[] = ["# Exported Messages\n"];
    for (const msg of messages) {
      if (!selectedIds.has(msg.id)) continue;
      const role = msg.role === "user" ? "**You**" : "**Assistant**";
      const text = msg.parts
        .filter((part) => part.type === "text")
        .map((part) => (part as { type: "text"; text: string }).text)
        .join("");
      if (text) lines.push(`${role}\n\n${text}`);
    }
    const blob = new Blob([lines.join("\n\n---\n\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "messages.md";
    anchor.click();
    URL.revokeObjectURL(url);
    clearSelection();
  }, [clearSelection, messages, selectedIds]);

  return {
    clearSelection,
    copySelected,
    exportSelected,
    selectedIds,
    selectionMode,
    setSelectionMode,
    toggleSelect,
  };
}

function useChatPluginActions(
  openChat: ReturnType<typeof useChatDrawer>["open"],
  setActivePluginId: (value: string | null) => void
) {
  const openToolAction = useCallback(
    (action: ToolAction) => {
      const pluginId = resolvePluginIdForAction(action);
      if (!pluginId) return;
      openChat();
      setActivePluginId(pluginId);
    },
    [openChat, setActivePluginId]
  );

  const handlePluginLinkMouseDownCapture = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (!extractPluginIdFromEventTarget(event.target)) return;
    event.preventDefault();
  }, []);

  const handlePluginLinkClickCapture = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      const pluginId = extractPluginIdFromEventTarget(event.target);
      if (!pluginId) return;
      event.preventDefault();
      openChat();
      setActivePluginId(pluginId);
    },
    [openChat, setActivePluginId]
  );

  return { handlePluginLinkClickCapture, handlePluginLinkMouseDownCapture, openToolAction };
}

function MessageToolCalls({
  isStreaming,
  onOpenToolAction,
  toolCalls,
  toolResults,
}: {
  isStreaming: boolean;
  onOpenToolAction: (action: ToolAction) => void;
  toolCalls: LlmMessagePart[];
  toolResults: LlmMessagePart[];
}) {
  if (toolCalls.length === 0) return null;

  return (
    <div className="mb-2 flex w-full flex-col gap-2">
      {toolCalls.map((tc) => {
        const call = tc as {
          type: "tool-call";
          toolCallId: string;
          toolName: string;
          args?: Record<string, unknown>;
        };
        const result = toolResults.find(
          (part) => (part as { toolCallId: string }).toolCallId === call.toolCallId
        ) as
          | { type: "tool-result"; toolName: string; output: unknown; isError?: boolean }
          | undefined;
        const action = result ? extractToolAction(result.output) : null;
        const pending = !result && isStreaming;

        return (
          <div key={call.toolCallId} className="w-full">
            <Reasoning isStreaming={pending} phase="tools">
              <div className="flex flex-col gap-2">
                <div className="font-bold text-w-xs uppercase tracking-tight">{call.toolName}</div>
                {call.args && Object.keys(call.args).length > 0 ? (
                  <pre className="overflow-x-auto whitespace-pre-wrap text-w-xs opacity-60">
                    {JSON.stringify(call.args, null, 2)}
                  </pre>
                ) : null}
                {result ? (
                  <div className="mt-1 border-border/20 border-t pt-2 font-mono text-w-xs">
                    {action ? (
                      <div className="mb-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onOpenToolAction(action)}
                          className="uppercase-none h-6 text-w-xs"
                        >
                          {action.openLabel}
                        </Button>
                      </div>
                    ) : null}
                    <pre className="whitespace-pre-wrap break-words opacity-80">
                      {typeof result.output === "string"
                        ? result.output
                        : JSON.stringify(result.output, null, 2)}
                    </pre>
                  </div>
                ) : null}
              </div>
            </Reasoning>
          </div>
        );
      })}
    </div>
  );
}

function UserMessageEditor({
  editValue,
  messageId,
  onCancelEdit,
  onCommitEdit,
  onEditValueChange,
}: {
  editValue: string;
  messageId: string;
  onCancelEdit: () => void;
  onCommitEdit: (id: string) => void;
  onEditValueChange: (value: string) => void;
}) {
  const attachEditTextareaRef = useCallback((node: HTMLTextAreaElement | null) => {
    if (!node) return;
    node.focus();
    node.setSelectionRange(node.value.length, node.value.length);
  }, []);

  return (
    <div className="text-right">
      <div className="inline-block w-full max-w-[85%] text-left">
        <Textarea
          ref={attachEditTextareaRef}
          value={editValue}
          onChange={(event) => onEditValueChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onCommitEdit(messageId);
            }
            if (event.key === "Escape") onCancelEdit();
          }}
          className="min-h-textarea rounded-panel rounded-br-sm border-accent/30 bg-accent/12 font-mono"
        />
        <div className="mt-1 flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancelEdit}
            className="uppercase-none h-auto p-1 font-mono text-dim text-w-sm transition-colors hover:bg-transparent hover:text-foreground"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onCommitEdit(messageId)}
            className="uppercase-none flex h-auto items-center gap-1 p-1 font-mono text-accent text-w-sm transition-colors hover:bg-transparent hover:text-accent"
          >
            <CheckIcon size={14} /> Send
          </Button>
        </div>
      </div>
    </div>
  );
}

function MessageTextContent({
  editValue,
  isEditing,
  isUser,
  messageId,
  onCancelEdit,
  onCommitEdit,
  onEditValueChange,
  onStartEdit,
  showStreamingCursor,
  text,
  timestamp,
}: {
  editValue: string;
  isEditing: boolean;
  isUser: boolean;
  messageId: string;
  onCancelEdit: () => void;
  onCommitEdit: (id: string) => void;
  onEditValueChange: (value: string) => void;
  onStartEdit: (id: string, text: string) => void;
  showStreamingCursor?: boolean;
  text: string;
  timestamp: string;
}) {
  if (!text) return null;

  if (isUser && isEditing) {
    return (
      <UserMessageEditor
        editValue={editValue}
        messageId={messageId}
        onCancelEdit={onCancelEdit}
        onCommitEdit={onCommitEdit}
        onEditValueChange={onEditValueChange}
      />
    );
  }

  return (
    <div className="relative w-full">
      <MessageContent title={timestamp}>
        {isUser ? (
          <p className="whitespace-pre-wrap">{text}</p>
        ) : (
          <Fragment>
            <ChatMarkdown>{text}</ChatMarkdown>
            {showStreamingCursor ? (
              <span
                className="ml-px inline-block h-3 w-px animate-pulse bg-accent align-middle"
                aria-hidden="true"
              />
            ) : null}
          </Fragment>
        )}
      </MessageContent>

      {isUser ? (
        <MessageAction
          tooltip="Edit message"
          onClick={() => onStartEdit(messageId, text)}
          className="absolute top-1 -left-8 opacity-0 transition-opacity group-hover/msg:opacity-100"
        >
          <PencilIcon size={12} />
        </MessageAction>
      ) : null}
    </div>
  );
}

const FEEDBACK_REASON_LABELS: Record<FeedbackReasonTag, string> = {
  wrong: "Wrong",
  incomplete: "Incomplete",
  tooLong: "Too long",
  other: "Other",
};

function useMessageFeedbackState({
  conversationId,
  messageId,
}: {
  conversationId: string | null;
  messageId: string;
}) {
  const [feedbackState, setFeedbackState] = useState<{
    note: string;
    reasonTag: FeedbackReasonTag | undefined;
    vote: "down" | "up" | null;
  }>({
    vote: null,
    reasonTag: undefined,
    note: "",
  });
  const [showFeedbackThanks, setShowFeedbackThanks] = useState(false);
  const feedbackTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!conversationId) return;
    const stored = getFeedback(conversationId, messageId);
    if (!stored) {
      setFeedbackState({
        vote: null,
        reasonTag: undefined,
        note: "",
      });
      return;
    }
    setFeedbackState({
      vote: stored.vote,
      reasonTag: stored.reasonTag,
      note: stored.note ?? "",
    });
  }, [conversationId, messageId]);

  useEffect(
    () => () => {
      if (feedbackTimerRef.current !== null) {
        window.clearTimeout(feedbackTimerRef.current);
      }
    },
    []
  );

  const handleResponseFeedback = useCallback(
    (next: "down" | "up" | null) => {
      persistResponseFeedbackVote(conversationId, messageId, next);
      submitChatResponseFeedbackToServer({
        kind: "vote",
        conversationId,
        messageId,
        vote: next,
      });
      if (feedbackTimerRef.current !== null) {
        window.clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = null;
      }
      if (!next) {
        setShowFeedbackThanks(false);
      } else {
        setShowFeedbackThanks(true);
        feedbackTimerRef.current = window.setTimeout(() => {
          setShowFeedbackThanks(false);
          feedbackTimerRef.current = null;
        }, 2200);
      }

      if (next === null) {
        setFeedbackState({
          vote: null,
          reasonTag: undefined,
          note: "",
        });
        return;
      }

      if (next === "up") {
        setFeedbackState({
          vote: "up",
          reasonTag: undefined,
          note: "",
        });
        return;
      }

      setFeedbackState((current) => ({ ...current, vote: "down" }));
    },
    [conversationId, messageId]
  );

  const handleSelectReasonTag = useCallback(
    (tag: FeedbackReasonTag) => {
      setFeedbackState((current) => ({ ...current, reasonTag: tag }));
      if (conversationId) patchFeedbackDown(conversationId, messageId, { reasonTag: tag });
      submitChatResponseFeedbackToServer({
        kind: "detail",
        conversationId,
        messageId,
        reasonTag: tag,
      });
    },
    [conversationId, messageId]
  );

  const setFeedbackNote = useCallback((note: string) => {
    setFeedbackState((current) => ({ ...current, note }));
  }, []);

  const commitFeedbackNote = useCallback(() => {
    if (!conversationId || feedbackState.vote !== "down") return;
    patchFeedbackDown(conversationId, messageId, {
      note: feedbackState.note.trim() || undefined,
    });
    submitChatResponseFeedbackToServer({
      kind: "detail",
      conversationId,
      messageId,
      note: feedbackState.note.trim() || undefined,
    });
  }, [conversationId, feedbackState.note, feedbackState.vote, messageId]);

  return {
    commitFeedbackNote,
    feedbackState,
    handleResponseFeedback,
    handleSelectReasonTag,
    setFeedbackNote,
    showFeedbackThanks,
  };
}

function FeedbackReasonPanel({
  note,
  onNoteBlur,
  onNoteChange,
  onSelectTag,
  reasonTag,
}: {
  note: string;
  onNoteBlur: () => void;
  onNoteChange: (value: string) => void;
  onSelectTag: (tag: FeedbackReasonTag) => void;
  reasonTag: FeedbackReasonTag | undefined;
}) {
  return (
    <div className="mt-2 w-full max-w-md rounded-item border border-border bg-surface-raised p-3 font-mono text-w-xs">
      <p className="mb-2 font-bold text-dim uppercase tracking-wider">What went wrong?</p>
      <div className="flex flex-wrap gap-2">
        {FEEDBACK_REASON_TAGS.map((tag) => (
          <Button
            key={tag}
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "uppercase-none h-7",
              reasonTag === tag && "border-accent bg-accent/10 text-accent"
            )}
            onClick={() => onSelectTag(tag)}
          >
            {FEEDBACK_REASON_LABELS[tag]}
          </Button>
        ))}
      </div>
      <Input
        value={note}
        onChange={(event) => onNoteChange(event.target.value)}
        onBlur={onNoteBlur}
        placeholder="Optional detail…"
        className="mt-2 h-8"
        aria-label="Optional feedback detail"
      />
      <p className="mt-1.5 text-dim/60 text-w-xs">Feedback is visible in debug events.</p>
    </div>
  );
}

function AssistantMessageFooter({
  copiedId,
  isLastAssistant,
  messageId,
  model,
  onCopy,
  onRegenerate,
  onResponseFeedback,
  onSaveToMemory,
  persistedOnDevice,
  responseFeedback,
  savedMemory,
  showFeedbackThanks,
  text,
}: {
  copiedId: string | null;
  isLastAssistant: boolean;
  messageId: string;
  model: string | undefined;
  onCopy: (id: string, text: string) => void;
  onRegenerate: () => void;
  onResponseFeedback: (next: "down" | "up" | null) => void;
  onSaveToMemory: () => void;
  persistedOnDevice: boolean;
  responseFeedback: "down" | "up" | null;
  savedMemory: boolean;
  showFeedbackThanks: boolean;
  text: string;
}) {
  return (
    <MessageActions>
      {model ? <span className="font-mono text-dim/60 text-w-sm">{model}</span> : null}
      <MessageAction tooltip="Copy response" onClick={() => onCopy(messageId, text)}>
        {copiedId === messageId ? (
          <CheckIcon size={16} className="text-success" />
        ) : (
          <CopyIcon size={16} />
        )}
      </MessageAction>
      {isLastAssistant ? (
        <MessageAction tooltip="Regenerate response" onClick={onRegenerate}>
          <RefreshCwIcon size={16} />
        </MessageAction>
      ) : null}
      <MessageAction
        tooltip="Helpful response"
        aria-label="Mark response as helpful"
        aria-pressed={responseFeedback === "up"}
        onClick={() => onResponseFeedback(responseFeedback === "up" ? null : "up")}
        className={cn(responseFeedback === "up" && "bg-muted/30 text-success hover:text-success")}
      >
        <ThumbsUpIcon size={16} />
      </MessageAction>
      <MessageAction
        tooltip="Not helpful"
        aria-label="Mark response as not helpful"
        aria-pressed={responseFeedback === "down"}
        onClick={() => onResponseFeedback(responseFeedback === "down" ? null : "down")}
        className={cn(
          responseFeedback === "down" && "bg-muted/30 text-destructive hover:text-destructive"
        )}
      >
        <ThumbsDownIcon size={16} />
      </MessageAction>
      {showFeedbackThanks ? (
        <span className="font-mono text-dim text-w-xs" role="status" aria-live="polite">
          {persistedOnDevice ? "Thanks — feedback recorded" : "Thanks"}
        </span>
      ) : null}
      <MessageAction tooltip="Save to memory" onClick={onSaveToMemory}>
        {savedMemory ? <CheckIcon size={16} className="text-success" /> : <BrainIcon size={16} />}
      </MessageAction>
    </MessageActions>
  );
}

function SaveMemoryForm({
  memoryKey,
  memoryValue,
  onChangeKey,
  onChangeValue,
  onClose,
  onSave,
  savingMemory,
}: {
  memoryKey: string;
  memoryValue: string;
  onChangeKey: (value: string) => void;
  onChangeValue: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
  savingMemory: boolean;
}) {
  return (
    <div className="mt-2 rounded-card border border-border bg-surface p-3 font-mono text-w-sm shadow-xl">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-dim text-w-sm uppercase tracking-wider">Save to memory</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close save to memory"
          className="icon-base uppercase-none text-dim/50 hover:bg-transparent hover:text-dim"
        >
          <XIcon size={14} />
        </Button>
      </div>
      <Input
        type="text"
        value={memoryKey}
        onChange={(event) => onChangeKey(event.target.value)}
        placeholder="Memory key…"
        className="mb-2 h-8 bg-background"
      />
      <Textarea
        value={memoryValue}
        onChange={(event) => onChangeValue(event.target.value)}
        rows={3}
        placeholder="Memory value…"
        className="mb-2 bg-background"
      />
      <Button
        type="button"
        size="sm"
        onClick={onSave}
        disabled={savingMemory || !memoryKey.trim() || !memoryValue.trim()}
        className="uppercase-none h-8 w-full"
      >
        {savingMemory ? <Loader2Icon size={12} className="mr-1.5 animate-spin" /> : null}
        Save Memory
      </Button>
    </div>
  );
}

function EmptyChatState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 p-8 text-center">
      <div className="border border-border/40 p-4">
        <BotIcon size={40} className="text-accent/30" />
      </div>
      <div>
        <p className="font-mono text-foreground text-w-lg">What can I help with?</p>
        <p className="mt-2 max-w-[360px] font-mono text-dim text-w-sm">
          Ask about your projects, revenue, priorities, or what to work on next.
        </p>
      </div>
    </div>
  );
}

function ChatInlineError({
  error,
  onClearError,
  onRetry,
}: {
  error: Error;
  onClearError: () => void;
  onRetry: () => void;
}) {
  const detail = error.message?.trim() || "Something went wrong.";
  const kind = classifyAssistantError(detail);
  const hint = assistantErrorHint(kind);

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className="rounded-item border border-destructive/25 bg-destructive-bg px-4 py-3 font-mono text-w-sm shadow-sm"
    >
      <p className="font-bold text-destructive uppercase tracking-wider">
        Couldn&apos;t get a response
      </p>
      <p className="mt-1 text-foreground-secondary">{detail}</p>
      <p className="mt-2 text-dim text-w-xs leading-relaxed">{hint}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="uppercase-none h-7"
          onClick={() => onRetry()}
        >
          <RefreshCwIcon size={12} className="mr-1.5" />
          Try again
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="uppercase-none h-7 text-dim"
          onClick={onClearError}
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}

function GenerationStoppedNotice({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      className="rounded-item border border-border bg-muted/30 px-4 py-2 font-mono text-dim text-w-xs"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-3">
        <p>
          <span className="font-bold text-foreground-secondary uppercase tracking-wider">
            Stopped
          </span>
          {" — "}
          Generation was interrupted. Send a follow-up or use Continue if the answer was cut off.
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onDismiss}
          aria-label="Dismiss stopped notice"
          className="icon-sm uppercase-none shrink-0 text-dim hover:text-foreground-secondary"
        >
          <XIcon size={12} />
        </Button>
      </div>
    </div>
  );
}

function SelectionToolbar({
  onClear,
  onCopy,
  onExport,
  selectedCount,
}: {
  onClear: () => void;
  onCopy: () => void;
  onExport: () => void;
  selectedCount: number;
}) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between border-border border-b bg-surface px-4 py-1.5 font-mono text-w-sm">
      <span className="text-dim">{selectedCount} selected</span>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={onCopy}
          disabled={selectedCount === 0}
          className="uppercase-none h-auto p-0 text-dim transition-colors hover:bg-transparent hover:text-foreground-secondary disabled:opacity-40"
        >
          Copy
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onExport}
          disabled={selectedCount === 0}
          className="uppercase-none h-auto p-0 text-dim transition-colors hover:bg-transparent hover:text-foreground-secondary disabled:opacity-40"
        >
          Export .md
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClear}
          aria-label="Clear selection"
          className="icon-base uppercase-none text-dim transition-colors hover:bg-transparent hover:text-foreground"
        >
          <XIcon size={10} />
        </Button>
      </div>
    </div>
  );
}

function SuggestedActionsSection({
  showContinue,
  isStreaming,
  messages,
  onContinue,
  onEditValueChange,
}: {
  showContinue: boolean;
  isStreaming: boolean;
  messages: LlmMessage[];
  onContinue: () => void;
  onEditValueChange: (value: string) => void;
}) {
  if (!((showContinue && !isStreaming) || (!isStreaming && messages.length > 0))) return null;

  return (
    <div className="py-6">
      <SuggestedActions>
        {showContinue ? <SuggestedAction onClick={onContinue}>↵ Continue</SuggestedAction> : null}
        {!showContinue && messages.length > 0 ? (
          <>
            <SuggestedAction onClick={() => onEditValueChange("Summarize this context")}>
              ✨ Summarize
            </SuggestedAction>
            <SuggestedAction onClick={() => onEditValueChange("What are the next steps?")}>
              🚀 Next Steps
            </SuggestedAction>
          </>
        ) : null}
      </SuggestedActions>
    </div>
  );
}

function ChatMessagesViewport({
  atBottom,
  bottomRef,
  branchAfterMessageId,
  contentRef,
  conversationId,
  copiedId,
  editValue,
  editingId,
  error,
  handlePluginLinkClickCapture,
  handlePluginLinkMouseDownCapture,
  isStreaming,
  lastAssistantIdx,
  messages,
  onCancelEdit,
  onClearError,
  onCommitEdit,
  onContinue,
  onCopyMessage,
  onCopySelected,
  onDismissGenerationStopped,
  onEditValueChange,
  onExportSelected,
  onOpenToolAction,
  onScroll,
  onScrollBottom,
  onStartEdit,
  onToggleSelect,
  regenerate,
  scrollRef,
  selectedIds,
  selectionMode,
  setSelectionMode,
  sessionStop,
  showContinue,
  showGenerationStopped,
}: {
  atBottom: boolean;
  bottomRef: RefObject<HTMLDivElement | null>;
  branchAfterMessageId: string | null;
  contentRef: RefObject<HTMLDivElement | null>;
  conversationId: string | null;
  copiedId: string | null;
  editValue: string;
  editingId: string | null;
  error: Error | null;
  handlePluginLinkClickCapture: (event: ReactMouseEvent<HTMLDivElement>) => void;
  handlePluginLinkMouseDownCapture: (event: ReactMouseEvent<HTMLDivElement>) => void;
  isStreaming: boolean;
  jumpToBottom: () => void;
  lastAssistantIdx: number;
  messages: LlmMessage[];
  onCancelEdit: () => void;
  onClearError: () => void;
  onCommitEdit: (id: string) => void;
  onContinue: () => void;
  onCopyMessage: (id: string, text: string) => void;
  onCopySelected: () => void;
  onDismissGenerationStopped: () => void;
  onEditValueChange: (value: string) => void;
  onExportSelected: () => void;
  onOpenToolAction: (action: ToolAction) => void;
  onScroll: () => void;
  onScrollBottom: () => void;
  onStartEdit: (id: string, text: string) => void;
  onToggleSelect: (id: string) => void;
  regenerate: () => void;
  scrollRef: RefObject<HTMLDivElement | null>;
  selectedIds: Set<string>;
  selectionMode: boolean;
  setSelectionMode: (value: boolean) => void;
  sessionStop: () => void;
  showContinue: boolean;
  showGenerationStopped: boolean;
}) {
  return (
    <Conversation>
      <ConversationContent
        ref={scrollRef}
        onMouseDownCapture={handlePluginLinkMouseDownCapture}
        onClickCapture={handlePluginLinkClickCapture}
        onScroll={onScroll}
      >
        {selectionMode ? (
          <SelectionToolbar
            onClear={() => setSelectionMode(false)}
            onCopy={onCopySelected}
            onExport={onExportSelected}
            selectedCount={selectedIds.size}
          />
        ) : null}

        <ConversationMessages ref={contentRef}>
          {!selectionMode && messages.length > 0 ? (
            <div className="flex justify-end">
              <ChatTooltipButton
                tooltip="Select messages"
                onClick={() => setSelectionMode(true)}
                className="flex items-center gap-1 font-mono text-dim/40 text-w-sm transition-colors hover:text-dim"
              >
                <ClipboardListIcon size={13} />
                Select
              </ChatTooltipButton>
            </div>
          ) : null}

          {messages.map((msg, idx) => (
            <MessageItem
              key={msg.id}
              conversationId={conversationId}
              msg={msg}
              isActivelyStreamingAssistant={
                isStreaming && idx === messages.length - 1 && msg.role === "assistant"
              }
              isLastAssistant={idx === lastAssistantIdx && !isStreaming}
              isBranchPoint={branchAfterMessageId === msg.id}
              isEditing={editingId === msg.id}
              editValue={editValue}
              copiedId={copiedId}
              isStreaming={isStreaming}
              selectionMode={selectionMode}
              isSelected={selectedIds.has(msg.id)}
              onStartEdit={onStartEdit}
              onCommitEdit={onCommitEdit}
              onCancelEdit={onCancelEdit}
              onCopy={onCopyMessage}
              onRegenerate={regenerate}
              onEditValueChange={onEditValueChange}
              onToggleSelect={onToggleSelect}
              onOpenToolAction={onOpenToolAction}
            />
          ))}

          {showGenerationStopped ? (
            <div className="py-2">
              <GenerationStoppedNotice onDismiss={onDismissGenerationStopped} />
            </div>
          ) : null}

          <SuggestedActionsSection
            showContinue={showContinue}
            isStreaming={isStreaming}
            messages={messages}
            onContinue={onContinue}
            onEditValueChange={onEditValueChange}
          />

          {error ? (
            <div className="py-2">
              <ChatInlineError error={error} onClearError={onClearError} onRetry={regenerate} />
            </div>
          ) : null}

          {messages.length > 0 ? (
            <div className="py-4">
              <Checkpoint label="Session Started" timestamp="New conversation initialized" />
            </div>
          ) : null}

          <div ref={bottomRef} />
        </ConversationMessages>
      </ConversationContent>

      <ConversationScrollButton atBottom={atBottom} onClick={onScrollBottom} />

      {isStreaming ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={sessionStop}
          aria-label="Stop generation"
          className="uppercase-none absolute right-4 bottom-16 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-dim shadow-md transition-colors hover:border-destructive/40 hover:text-destructive"
        >
          <SquareIcon size={12} />
        </Button>
      ) : null}
    </Conversation>
  );
}

function MessageItem({
  conversationId,
  msg,
  isActivelyStreamingAssistant,
  isLastAssistant,
  isBranchPoint,
  isEditing,
  editValue,
  copiedId,
  isStreaming,
  selectionMode,
  isSelected,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  onCopy,
  onRegenerate,
  onEditValueChange,
  onToggleSelect,
  onOpenToolAction,
}: {
  conversationId: string | null;
  msg: LlmMessage;
  isActivelyStreamingAssistant: boolean;
  isLastAssistant: boolean;
  isBranchPoint: boolean;
  isEditing: boolean;
  editValue: string;
  copiedId: string | null;
  isStreaming: boolean;
  selectionMode: boolean;
  isSelected: boolean;
  onStartEdit: (id: string, text: string) => void;
  onCommitEdit: (id: string) => void;
  onCancelEdit: () => void;
  onCopy: (id: string, text: string) => void;
  onRegenerate: () => void;
  onEditValueChange: (v: string) => void;
  onToggleSelect: (id: string) => void;
  onOpenToolAction: (action: ToolAction) => void;
}) {
  const isUser = msg.role === "user";
  const textParts = msg.parts.filter((p: LlmMessagePart) => p.type === "text");
  const text = textParts.map((p) => (p as { type: "text"; text: string }).text).join("");
  const toolCalls = msg.parts.filter((p: LlmMessagePart) => p.type === "tool-call");
  const toolResults = msg.parts.filter((p: LlmMessagePart) => p.type === "tool-result");
  const reasoningParts = msg.parts.filter((p: LlmMessagePart) => p.type === "reasoning");
  const timestamp = msg.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const [memoryState, setMemoryState] = useState(() => ({
    key: "",
    saved: false,
    saving: false,
    value: "",
    visible: false,
  }));
  const {
    commitFeedbackNote,
    feedbackState,
    handleResponseFeedback,
    handleSelectReasonTag,
    setFeedbackNote,
    showFeedbackThanks,
  } = useMessageFeedbackState({
    conversationId,
    messageId: msg.id,
  });

  const openSaveForm = () => {
    setMemoryState({
      key: `note-${Date.now()}`,
      saved: false,
      saving: false,
      value: text.slice(0, 500),
      visible: true,
    });
  };

  const saveMemory = async () => {
    if (!memoryState.key.trim() || !memoryState.value.trim()) return;
    setMemoryState((current) => ({ ...current, saving: true }));
    try {
      await fetch(API_ROUTES.chatMemory, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: memoryState.key.trim(),
          value: memoryState.value.trim(),
        }),
      });
      setMemoryState((current) => ({ ...current, saved: true, saving: false, visible: false }));
      setTimeout(() => {
        setMemoryState((current) => ({ ...current, saved: false }));
      }, 2000);
    } catch {
      // Non-critical
      setMemoryState((current) => ({ ...current, saving: false }));
    }
  };

  return (
    <div className={cn("group/msg relative", selectionMode ? "flex items-start gap-3" : "")}>
      {/* Selection checkbox */}
      {selectionMode ? (
        <Button
          type="button"
          variant="ghost"
          onClick={() => onToggleSelect(msg.id)}
          aria-label={isSelected ? "Deselect message" : "Select message"}
          className={cn(
            "icon-sm uppercase-none mt-1.5 flex shrink-0 items-center justify-center rounded-none border p-0 transition-colors",
            isSelected
              ? "border-accent bg-accent text-white"
              : "border-border hover:border-accent/60"
          )}
        >
          {isSelected ? <CheckIcon size={10} /> : null}
        </Button>
      ) : null}

      <Message role={isUser ? "user" : "assistant"}>
        {/* Branch point indicator */}
        {isBranchPoint ? (
          <div className="mb-1 flex w-full items-center gap-2 font-mono text-dim/40 text-w-xs uppercase tracking-tighter">
            <div className="h-px flex-1 bg-border/20" />
            <span>branched</span>
            <div className="h-px flex-1 bg-border/20" />
          </div>
        ) : null}

        <MessageToolCalls
          isStreaming={isStreaming}
          onOpenToolAction={onOpenToolAction}
          toolCalls={toolCalls}
          toolResults={toolResults}
        />

        {reasoningParts.map((rp, idx) => {
          const reasoningText = (rp as { text: string }).text;
          const reasoningKey = `${msg.id}-rp-${reasoningText.slice(0, 48)}-${reasoningText.length}-${idx === reasoningParts.length - 1 ? "last" : "mid"}`;

          return (
            <Reasoning
              key={reasoningKey}
              isStreaming={isStreaming && idx === reasoningParts.length - 1}
            >
              {reasoningText}
            </Reasoning>
          );
        })}

        <MessageTextContent
          editValue={editValue}
          isEditing={isEditing}
          isUser={isUser}
          messageId={msg.id}
          onCancelEdit={onCancelEdit}
          onCommitEdit={onCommitEdit}
          onEditValueChange={onEditValueChange}
          onStartEdit={onStartEdit}
          showStreamingCursor={isActivelyStreamingAssistant}
          text={text}
          timestamp={timestamp}
        />

        {!isUser && text ? (
          <>
            <AssistantMessageFooter
              copiedId={copiedId}
              isLastAssistant={isLastAssistant}
              messageId={msg.id}
              model={msg.model}
              onCopy={onCopy}
              onRegenerate={onRegenerate}
              onResponseFeedback={handleResponseFeedback}
              onSaveToMemory={openSaveForm}
              persistedOnDevice={Boolean(conversationId)}
              responseFeedback={feedbackState.vote}
              savedMemory={memoryState.saved}
              showFeedbackThanks={showFeedbackThanks}
              text={text}
            />
            {feedbackState.vote === "down" ? (
              <FeedbackReasonPanel
                note={feedbackState.note}
                onNoteBlur={commitFeedbackNote}
                onNoteChange={setFeedbackNote}
                onSelectTag={handleSelectReasonTag}
                reasonTag={feedbackState.reasonTag}
              />
            ) : null}
          </>
        ) : null}

        {memoryState.visible ? (
          <div className="mt-2 w-full max-w-sm">
            <SaveMemoryForm
              memoryKey={memoryState.key}
              memoryValue={memoryState.value}
              onChangeKey={(value) => setMemoryState((current) => ({ ...current, key: value }))}
              onChangeValue={(value) => setMemoryState((current) => ({ ...current, value }))}
              onClose={() => setMemoryState((current) => ({ ...current, visible: false }))}
              onSave={saveMemory}
              savingMemory={memoryState.saving}
            />
          </div>
        ) : null}
      </Message>
    </div>
  );
}

function useChatMessagesViewportState({
  conversationId,
  error,
  messages,
  status,
  stop,
}: {
  conversationId: string | null;
  error: unknown;
  messages: LlmMessage[];
  status: string;
  stop: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const stopRequestedRef = useRef(false);
  const pendingInitialScrollRef = useRef(true);
  const stickToBottomRef = useRef(true);
  const [atBottom, setAtBottom] = useState(true);
  const [showGenerationStopped, setShowGenerationStopped] = useState(false);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const forceBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  const updateAtBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distance <= STICK_TO_BOTTOM_THRESHOLD_PX;
    setAtBottom(distance <= AT_BOTTOM_THRESHOLD_PX);
  }, []);

  const settleAtBottom = useCallback(() => {
    let cancelled = false;
    let attempts = 0;
    let settleTimeout = 0;

    const tick = () => {
      if (cancelled) return;
      forceBottom();
      updateAtBottom();

      const el = scrollRef.current;
      const distance = el ? el.scrollHeight - el.scrollTop - el.clientHeight : 0;
      attempts += 1;

      if (distance > AT_BOTTOM_THRESHOLD_PX && attempts < 8) {
        settleTimeout = window.setTimeout(tick, 50);
      }
    };

    const settleFrame = window.requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(settleFrame);
      window.clearTimeout(settleTimeout);
    };
  }, [forceBottom, updateAtBottom]);

  useEffect(() => {
    if (status !== "ready") return;
    if (!stopRequestedRef.current || error) return;
    stopRequestedRef.current = false;
    setShowGenerationStopped(true);
  }, [status, error]);

  const handleSessionStop = useCallback(() => {
    stopRequestedRef.current = true;
    stop();
  }, [stop]);

  const shouldShowGenerationStopped =
    showGenerationStopped && !error && status !== "submitted" && status !== "streaming";

  const messageSignature = messages
    .map((message) =>
      message.parts
        .filter((part) => part.type === "text")
        .map((part) => (part as { type: "text"; text: string }).text)
        .join("")
    )
    .join("\u0000");
  const autoScrollTrigger = `${status}:${messageSignature}`;

  useEffect(() => {
    pendingInitialScrollRef.current = true;
    stickToBottomRef.current = true;
    setAtBottom(true);
  }, [conversationId]);

  useLayoutEffect(() => {
    autoScrollTrigger;
    if (!stickToBottomRef.current) return;
    let cleanupSettle: (() => void) | undefined;
    const frame = window.requestAnimationFrame(() => {
      if (pendingInitialScrollRef.current && messages.length > 0) {
        forceBottom();
        pendingInitialScrollRef.current = false;
      } else {
        scrollToBottom("auto");
      }
      updateAtBottom();
      cleanupSettle = settleAtBottom();
    });
    return () => {
      window.cancelAnimationFrame(frame);
      cleanupSettle?.();
    };
  }, [
    autoScrollTrigger,
    forceBottom,
    messages.length,
    scrollToBottom,
    settleAtBottom,
    updateAtBottom,
  ]);

  useEffect(() => {
    updateAtBottom();
  }, [updateAtBottom]);

  useEffect(() => {
    const content = contentRef.current;
    const scroller = scrollRef.current;
    if ((!content && !scroller) || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (!stickToBottomRef.current) return;
      scrollToBottom("auto");
      updateAtBottom();
      settleAtBottom();
    });
    if (content) observer.observe(content);
    if (scroller) observer.observe(scroller);
    return () => observer.disconnect();
  }, [scrollToBottom, settleAtBottom, updateAtBottom]);

  const jumpToBottom = useCallback(() => {
    stickToBottomRef.current = true;
    forceBottom();
    updateAtBottom();
    settleAtBottom();
  }, [forceBottom, settleAtBottom, updateAtBottom]);

  return {
    atBottom,
    bottomRef,
    contentRef,
    handleSessionStop,
    jumpToBottom,
    scrollRef,
    setShowGenerationStopped,
    shouldShowGenerationStopped,
    updateAtBottom,
  };
}

/**
 * Clean message list. No heavy bubbles, no avatars on user messages.
 * Follows ChatGPT/Claude/t3chat patterns.
 */
export function ChatMessages({ conversationId }: { conversationId: string | null }) {
  const { session, registerEditLastMessage, branchAfterMessageId, setBranchAfterMessageId } =
    useChatContext();
  const { open: openChat } = useChatDrawer();
  const [, setActivePluginId] = useQueryState("plugin", parseAsString);
  const {
    messages,
    status,
    error,
    regenerate,
    truncateMessagesAfter,
    sendMessage,
    stop,
    clearError,
  } = session;
  const [messageUi, setMessageUi] = useState(() => ({
    copiedId: null as string | null,
    editValue: "",
    editingId: null as string | null,
    showContinue: false,
  }));
  const prevStatusRef = useRef(status);
  const { copiedId, editValue, editingId, showContinue } = messageUi;
  const {
    clearSelection,
    copySelected,
    exportSelected,
    selectedIds,
    selectionMode,
    setSelectionMode,
    toggleSelect,
  } = useMessageSelection(messages);
  const { handlePluginLinkClickCapture, handlePluginLinkMouseDownCapture, openToolAction } =
    useChatPluginActions(openChat, setActivePluginId);
  const {
    atBottom,
    bottomRef,
    contentRef,
    handleSessionStop,
    jumpToBottom,
    scrollRef,
    setShowGenerationStopped,
    shouldShowGenerationStopped,
    updateAtBottom,
  } = useChatMessagesViewportState({
    conversationId,
    error,
    messages,
    status,
    stop,
  });

  // Track when user manually stops the stream mid-way
  useEffect(() => {
    if (prevStatusRef.current !== "ready" && status === "ready") {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg?.role === "assistant") {
        const text = lastMsg.parts
          .filter((p) => p.type === "text")
          .map((p) => (p as { type: "text"; text: string }).text)
          .join("");
        setMessageUi((current) => ({
          ...current,
          showContinue: text.length > 0 && !/[.!?»\n]$/.test(text.trimEnd()),
        }));
      }
    }
    if (status === "streaming" || status === "submitted") {
      setMessageUi((current) =>
        current.showContinue ? { ...current, showContinue: false } : current
      );
    }
    prevStatusRef.current = status;
  }, [status, messages]);

  const startEdit = useCallback((id: string, text: string) => {
    setMessageUi((current) => ({ ...current, editValue: text, editingId: id }));
  }, []);

  // Register edit-last-message callback for the composer to call on ↑ key
  useEffect(() => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMsg) {
      registerEditLastMessage(null);
      return;
    }
    const text = lastUserMsg.parts
      .filter((p) => p.type === "text")
      .map((p) => (p as { type: "text"; text: string }).text)
      .join("");
    registerEditLastMessage(() => startEdit(lastUserMsg.id, text));
    return () => registerEditLastMessage(null);
  }, [messages, registerEditLastMessage, startEdit]);

  // Clear branch marker once a new message arrives after the branch
  useEffect(() => {
    if (!branchAfterMessageId) return;
    const idx = messages.findIndex((m) => m.id === branchAfterMessageId);
    if (idx === -1 || messages.length > idx + 1) {
      setBranchAfterMessageId(null);
    }
  }, [messages, branchAfterMessageId, setBranchAfterMessageId]);

  const copyMessage = useCallback((id: string, text: string) => {
    import("@radarboard/utils/clipboard").then(({ copyText }) =>
      copyText(text).then(() => {
        setMessageUi((current) => ({ ...current, copiedId: id }));
        setTimeout(() => {
          setMessageUi((current) => ({ ...current, copiedId: null }));
        }, 2000);
      })
    );
  }, []);

  const commitEdit = useCallback(
    (messageId: string) => {
      const text = editValue.trim();
      if (!text) {
        setMessageUi((current) => ({ ...current, editingId: null }));
        return;
      }
      const branchId = truncateMessagesAfter(messageId);
      if (branchId) setBranchAfterMessageId(branchId);
      sendMessage(text);
      setMessageUi((current) => ({ ...current, editValue: "", editingId: null }));
    },
    [editValue, truncateMessagesAfter, sendMessage, setBranchAfterMessageId]
  );

  const cancelEdit = useCallback(() => {
    setMessageUi((current) => ({ ...current, editValue: "", editingId: null }));
  }, []);

  if (messages.length === 0) {
    return <EmptyChatState />;
  }

  const isStreaming = status === "streaming" || status === "submitted";
  const lastAssistantIdx = messages.reduce(
    (last, msg, idx) => (msg.role === "assistant" ? idx : last),
    -1
  );

  return (
    <ChatMessagesViewport
      atBottom={atBottom}
      bottomRef={bottomRef}
      branchAfterMessageId={branchAfterMessageId}
      contentRef={contentRef}
      conversationId={conversationId}
      copiedId={copiedId}
      editValue={editValue}
      editingId={editingId}
      error={error}
      handlePluginLinkClickCapture={handlePluginLinkClickCapture}
      handlePluginLinkMouseDownCapture={handlePluginLinkMouseDownCapture}
      isStreaming={isStreaming}
      jumpToBottom={jumpToBottom}
      lastAssistantIdx={lastAssistantIdx}
      messages={messages}
      onCancelEdit={cancelEdit}
      onClearError={clearError}
      onCommitEdit={commitEdit}
      onContinue={() => {
        setMessageUi((current) => ({ ...current, showContinue: false }));
        sendMessage("Please continue from where you left off.");
      }}
      onCopyMessage={copyMessage}
      onCopySelected={copySelected}
      onDismissGenerationStopped={() => setShowGenerationStopped(false)}
      onEditValueChange={(value) => setMessageUi((current) => ({ ...current, editValue: value }))}
      onExportSelected={exportSelected}
      onOpenToolAction={openToolAction}
      onScroll={updateAtBottom}
      onScrollBottom={jumpToBottom}
      onStartEdit={startEdit}
      onToggleSelect={toggleSelect}
      regenerate={regenerate}
      scrollRef={scrollRef}
      selectedIds={selectedIds}
      selectionMode={selectionMode}
      setSelectionMode={(value) => {
        if (value) {
          setSelectionMode(true);
          return;
        }
        clearSelection();
      }}
      sessionStop={handleSessionStop}
      showContinue={showContinue}
      showGenerationStopped={shouldShowGenerationStopped}
    />
  );
}
