"use client";

import type { AssistantHandoffItem } from "@radarboard/types/assistant";
import { Button } from "@radarboard/ui/button";
import { MessageSquarePlusIcon } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { useCallback } from "react";
import { chatActions, ensureThread } from "./chat-store";
import { useChatDrawer } from "./use-chat-drawer";

export type AssistantHandoffPromptKind =
  | "evaluate-next-action"
  | "summarize-link"
  | "compare-query"
  | "discuss-item";

const DEFAULT_PROMPT_TEMPLATES: Record<AssistantHandoffPromptKind, string> = {
  "evaluate-next-action":
    "Help me evaluate this next action. Explain the expected impact, risks, tradeoffs, and the best way to execute it.",
  "summarize-link":
    "Summarize this link, explain why it matters, and tell me whether I should act on it.",
  "compare-query":
    "Compare this query with the rest of the project's SEO signals and tell me what to do next.",
  "discuss-item":
    "Help me reason about this item. Summarize it, explain why it matters, and suggest the best next step.",
};

export function buildAssistantHandoffPrompt(
  kind: AssistantHandoffPromptKind,
  item: AssistantHandoffItem
): string {
  switch (kind) {
    case "evaluate-next-action":
      return `${DEFAULT_PROMPT_TEMPLATES[kind]}\n\nFocus on: ${item.title}`;
    case "summarize-link":
      return `${DEFAULT_PROMPT_TEMPLATES[kind]}\n\nLink: ${item.title}`;
    case "compare-query":
      return `${DEFAULT_PROMPT_TEMPLATES[kind]}\n\nQuery: ${item.title}`;
    default:
      return `${DEFAULT_PROMPT_TEMPLATES[kind]}\n\nItem: ${item.title}`;
  }
}

export interface SendToAssistantOptions {
  item: AssistantHandoffItem;
  promptTemplate?: string;
  openChat?: boolean;
  pinProject?: string | null;
}

export function useAssistantHandoff() {
  const { open } = useChatDrawer();

  const sendToAssistant = useCallback(
    async ({ item, promptTemplate, openChat = true, pinProject }: SendToAssistantOptions) => {
      const projectSlug = pinProject ?? item.projectSlug ?? null;
      if (projectSlug) {
        chatActions.setPinnedProject(projectSlug);
      }

      if (openChat) {
        open();
      }

      await ensureThread();
      chatActions.queueAssistantHandoff({
        items: [item],
        promptText: promptTemplate ?? null,
      });
    },
    [open]
  );

  return { sendToAssistant };
}

interface SendToAssistantButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  item: AssistantHandoffItem;
  promptTemplate?: string;
  pinProject?: string | null;
  compact?: boolean;
  label?: string;
}

export function SendToAssistantButton({
  item,
  promptTemplate,
  pinProject,
  compact = false,
  label,
  className,
  type = "button",
  ...props
}: SendToAssistantButtonProps) {
  const { sendToAssistant } = useAssistantHandoff();

  return (
    <Button
      type={type}
      onClick={() => {
        sendToAssistant({
          item,
          promptTemplate,
          pinProject,
          openChat: true,
        });
      }}
      variant="outline"
      size={compact ? "xs" : "sm"}
      uppercase={compact}
      className={[
        compact ? "text-dim" : "text-dim text-w-sm",
        "hover:border-[#3a3a3a] hover:text-foreground-secondary",
        className ?? "",
      ].join(" ")}
      {...props}
    >
      <MessageSquarePlusIcon className={compact ? "icon-xs" : "icon-xs"} />
      {label ?? (compact ? "Discuss" : "Discuss with Assistant")}
    </Button>
  );
}
