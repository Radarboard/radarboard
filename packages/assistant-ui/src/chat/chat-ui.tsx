"use client";

import { Button } from "@radarboard/ui/button";
import { cn } from "@radarboard/utils/cn";
import {
  ArrowDownIcon,
  BotIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CircleDotIcon,
  Loader2Icon,
  UserIcon,
} from "lucide-react";
import type { ComponentProps, ComponentType, HTMLAttributes, ReactNode, RefObject } from "react";
import { useState } from "react";
import { ChatTooltipButton } from "./chat-tooltip-button";

// ============================================================================
// Message Components
// ============================================================================

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  role: "user" | "assistant" | "system";
};

export const Message = ({ className, role, children, ...props }: MessageProps) => (
  <div
    data-role={role}
    className={cn(
      "group flex w-full gap-4 px-5 py-5 first:pt-4",
      role === "user" ? "flex-row-reverse" : "flex-row",
      className
    )}
    {...props}
  >
    {/* Avatar */}
    <div className="shrink-0 pt-0.5">
      <div
        className={cn(
          "flex h-9 w-9 items-center justify-center border",
          role === "user"
            ? "border-border bg-surface-raised text-foreground"
            : "border-accent/20 bg-accent/10 text-accent"
        )}
      >
        {role === "user" ? <UserIcon size={18} /> : <BotIcon size={18} />}
      </div>
    </div>

    {/* Content Wrapper */}
    <div
      className={cn(
        "flex min-w-0 flex-1 flex-col gap-2",
        role === "user" ? "items-end" : "items-start"
      )}
    >
      <span className="sr-only">{role === "user" ? "User" : "Assistant"}</span>
      {children}
    </div>
  </div>
);

export const MessageContent = ({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex w-fit min-w-0 max-w-full flex-col gap-2 overflow-hidden",
      "group-[.is-user]:border group-[.is-user]:border-border group-[.is-user]:bg-surface-raised group-[.is-user]:px-4 group-[.is-user]:py-3 group-[.is-user]:text-foreground group-[.is-user]:text-w-sm group-[.is-user]:shadow-sm",
      "leading-relaxed group-[.is-assistant]:text-foreground-secondary group-[.is-assistant]:text-w-sm",
      className
    )}
    {...props}
  >
    {children}
  </div>
);

// ============================================================================
// Reasoning & Flow
// ============================================================================

export const Reasoning = ({
  children,
  className,
  isStreaming,
  duration,
  phase = "reasoning",
  ...props
}: {
  children: ReactNode;
  className?: string;
  isStreaming?: boolean;
  duration?: number;
  /** Distinguishes tool execution from model reasoning copy. */
  phase?: "reasoning" | "tools";
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const effectiveOpen = isStreaming || isOpen;

  const streamingLabel = phase === "tools" ? "Using tools…" : "Reasoning…";
  const doneLabel = phase === "tools" ? "Tools finished" : `Thought for ${duration ?? 0}s`;
  const statusLabel = isStreaming ? streamingLabel : doneLabel;

  return (
    <div className={cn("flex w-full flex-col gap-2 py-2", className)} {...props}>
      <button
        type="button"
        aria-expanded={effectiveOpen}
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-fit items-center gap-2 font-bold font-mono text-dim/40 text-w-sm uppercase tracking-wider transition-colors hover:text-foreground"
      >
        {effectiveOpen ? <ChevronDownIcon size={14} /> : <ChevronRightIcon size={14} />}
        <span>{statusLabel}</span>
        {Boolean(isStreaming) && <Loader2Icon size={14} className="animate-spin text-accent/60" />}
      </button>
      {Boolean(effectiveOpen) && (
        <div className="whitespace-pre-wrap border-border/20 border-l py-1 pl-4 text-foreground-secondary text-w-sm italic leading-relaxed opacity-80">
          {children}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Prompt Input (Gold Standard Pattern)
// ============================================================================

export const PromptInput = ({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col overflow-hidden border border-border bg-surface shadow-2xl transition-all focus-within:border-accent/60 focus-within:ring-1 focus-within:ring-accent/10",
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export const PromptInputHeader = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-wrap items-center gap-2.5 border-border/30 border-b bg-muted/5 px-5 py-3 empty:hidden",
      className
    )}
    {...props}
  />
);

export const PromptInputBody = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("relative flex-1", className)} {...props} />
);

export const PromptInputFooter = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex items-center justify-between border-border/30 border-t bg-muted/5 px-5 py-3",
      className
    )}
    {...props}
  />
);

export const PromptInputTools = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex items-center gap-2", className)} {...props} />
);

/**
 * Polished Model/Mode Selector Trigger
 */
export const ModelSelectorTrigger = ({
  label,
  icon: Icon,
  active,
  className,
  ...props
}: {
  label: string;
  icon?: ComponentType<{ size?: number }>;
  active?: boolean;
  className?: string;
} & HTMLAttributes<HTMLButtonElement>) => (
  <button
    type="button"
    className={cn(
      "flex items-center gap-1.5 border border-transparent px-2.5 py-1.5 font-bold font-mono text-w-xs uppercase tracking-widest outline-none transition-all",
      active
        ? "border-accent/10 bg-accent/5 text-accent"
        : "text-dim/60 hover:bg-muted/20 hover:text-foreground",
      className
    )}
    {...props}
  >
    {Icon ? <Icon size={14} /> : null}

    <span>{label}</span>
    <ChevronDownIcon size={12} className="opacity-40" />
  </button>
);

// ============================================================================
// Viewport
// ============================================================================

export const Conversation = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("relative flex min-h-0 flex-1 flex-col", className)} {...props} />
);

export const ConversationHeader = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "sticky top-0 z-30 flex shrink-0 items-center justify-between gap-2 border-border border-b bg-surface/80 px-5 py-3.5 backdrop-blur-sm",
      className
    )}
    {...props}
  />
);

export const ConversationContent = ({
  className,
  ref,
  ...props
}: HTMLAttributes<HTMLDivElement> & { ref?: RefObject<HTMLDivElement | null> }) => (
  <div
    ref={ref}
    className={cn("scrollbar-thin relative flex-1 overflow-y-auto scroll-smooth", className)}
    {...props}
  />
);
ConversationContent.displayName = "ConversationContent";

export const ConversationMessages = ({
  className,
  ref,
  ...props
}: HTMLAttributes<HTMLDivElement> & { ref?: RefObject<HTMLDivElement | null> }) => (
  <div
    ref={ref}
    className={cn("mx-auto flex w-full max-w-[768px] flex-col pb-32", className)}
    {...props}
  />
);
ConversationMessages.displayName = "ConversationMessages";

export const ConversationScrollButton = ({
  atBottom,
  onClick,
}: {
  atBottom: boolean;
  onClick: () => void;
}) => {
  if (atBottom) return null;
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={onClick}
      className="uppercase-none absolute bottom-8 left-1/2 z-40 h-11 w-11 -translate-x-1/2 rounded-full border border-border bg-surface/95 shadow-xl backdrop-blur transition-all hover:scale-110 active:scale-95"
    >
      <ArrowDownIcon size={20} className="text-dim" />
    </Button>
  );
};

// ============================================================================
// Wrappers
// ============================================================================

export const Prompt = ({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "sticky bottom-0 z-20 w-full bg-gradient-to-t from-surface via-surface to-transparent pt-16 pb-8",
      className
    )}
    {...props}
  >
    <div className="mx-auto flex w-full max-w-[768px] flex-col gap-4 px-4">{children}</div>
  </div>
);

// ============================================================================
// Suggestion Chips
// ============================================================================

export const SuggestedAction = ({
  children,
  className,
  ...props
}: ComponentProps<typeof Button>) => (
  <Button
    variant="outline"
    size="sm"
    className={cn(
      "uppercase-none h-10 rounded-none border-border/60 bg-surface px-4 font-bold font-mono text-dim/70 text-w-sm shadow-sm transition-all hover:border-accent/40 hover:bg-accent/5 hover:text-accent",
      className
    )}
    {...props}
  >
    {children}
  </Button>
);

export const SuggestedActions = ({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-wrap justify-center gap-2", className)} {...props}>
    {children}
  </div>
);

// ============================================================================
// Primitives
// ============================================================================

export const MessageActions = ({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("mt-3 flex items-center gap-3 empty:hidden", className)} {...props}>
    {children}
  </div>
);

export const MessageAction = ({
  className,
  ...props
}: ComponentProps<typeof ChatTooltipButton>) => (
  <ChatTooltipButton
    className={cn(
      "h-8 w-8 text-dim/40 transition-colors hover:bg-muted/20 hover:text-foreground",
      className
    )}
    {...props}
  />
);

export const Checkpoint = ({
  label,
  timestamp,
  onClick,
  className,
}: {
  label: string;
  timestamp?: string;
  onClick?: () => void;
  className?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "group/cp flex w-full items-center gap-4 border-accent/10 border-y bg-accent/5 px-6 py-3 text-left transition-colors hover:bg-accent/10",
      className
    )}
  >
    <CircleDotIcon size={14} className="text-accent" />
    <div className="min-w-0 flex-1">
      <div className="font-bold text-foreground text-w-sm uppercase tracking-widest">{label}</div>
      {Boolean(timestamp) && (
        <div className="mt-0.5 font-mono text-dim/40 text-w-xs lowercase">{timestamp}</div>
      )}
    </div>
    <ChevronRightIcon
      size={14}
      className="text-dim opacity-0 transition-opacity group-hover/cp:opacity-100"
    />
  </button>
);
