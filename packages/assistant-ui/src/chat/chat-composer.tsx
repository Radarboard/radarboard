"use client";

import { getAssistantModeLabel } from "@radarboard/assistant-core/assistant-workflows";
import { useDemoMode } from "@radarboard/hooks/use-demo-mode";
import { API_ROUTES, buildApiRoute } from "@radarboard/types/api-routes";
import type { AssistantHandoffItem } from "@radarboard/types/assistant";
import { Button } from "@radarboard/ui/button";
import { Label } from "@radarboard/ui/label";
import {
  RichTextComposer,
  type RichTextComposerChangeMeta,
  type RichTextComposerHandle,
} from "@radarboard/ui/rich-text-composer";
import { Tooltip, TooltipContent, TooltipTrigger } from "@radarboard/ui/tooltip";
import { cn } from "@radarboard/utils/cn";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useStore } from "@tanstack/react-store";
import {
  ArrowUpIcon,
  FileTextIcon,
  ImageIcon,
  Loader2Icon,
  PlusIcon,
  SquareIcon,
  XIcon,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { ChatCommandMenu } from "./chat-command-menu";
import { useChatContext } from "./chat-context";
import {
  buildInsertCommandGroups,
  type ChatInsertCommandItem,
  filterInsertCommandItems,
  type InsertCommandScope,
  parseInsertCommand,
  useChatInsertData,
} from "./chat-insert-data";
import { ChatInsertMenu } from "./chat-insert-menu";
import { ChatModeSelector } from "./chat-mode-selector";
import { ChatChallengerSelector, ChatModelSelector } from "./chat-model-selector";
import { ChatPresetChips } from "./chat-preset-chips";
import { chatActions, chatStore } from "./chat-store";
import {
  Prompt,
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputTools,
} from "./chat-ui";

type AttachedImage = { id: string; dataUrl: string; mimeType: string; name: string };
type AttachedFile = { id: string; name: string; content: string; size: number };
type AttachedSkill = { id: string; name: string; description: string; builtin: boolean };
type AttachedStoredContextItem = {
  id: string;
  kind: "artifact" | "note";
  title: string;
  badge?: string;
};
type AttachedRuntimeContextItem = {
  id: string;
  kind: "runtime";
  title: string;
  badge?: string;
  item: AssistantHandoffItem;
};
type AttachedContextItem = AttachedStoredContextItem | AttachedRuntimeContextItem;
type InlineRange = { from: number; to: number };

async function fetchProjectSlugs(url: string): Promise<string[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load projects: ${response.status}`);
  }
  return (await response.json()) as string[];
}

async function fetchComposerSkills(url: string): Promise<AttachedSkill[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load skills: ${response.status}`);
  }
  return (await response.json()) as AttachedSkill[];
}

function getAttachedContextKey(item: AttachedContextItem): string {
  if (item.kind === "runtime") {
    return `runtime:${item.item.kind}:${item.id}`;
  }
  return `${item.kind}:${item.id}`;
}

function toAttachedRuntimeContextItem(item: AssistantHandoffItem): AttachedRuntimeContextItem {
  return {
    id: item.id,
    kind: "runtime",
    title: item.title,
    badge: item.badge,
    item,
  };
}

function handleMentionEscape(
  event: React.KeyboardEvent<HTMLDivElement>,
  mentionQuery: string | null,
  filteredCount: number,
  setMentionQuery: React.Dispatch<React.SetStateAction<string | null>>,
  mentionRangeRef: React.MutableRefObject<unknown>
): boolean {
  if (mentionQuery !== null && filteredCount > 0 && event.key === "Escape") {
    event.preventDefault();
    setMentionQuery(null);
    mentionRangeRef.current = null;
    return true;
  }
  return false;
}

function handleGlobalKeys(
  event: React.KeyboardEvent<HTMLDivElement>,
  composerValue: string,
  handleSubmit: () => Promise<void>,
  editLastUserMessage: () => void
): boolean {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    handleSubmit().catch(() => {
      /* fire-and-forget */
    });
    return true;
  }

  if (event.key === "ArrowUp" && composerValue.trim() === "") {
    event.preventDefault();
    editLastUserMessage();
    return true;
  }

  return false;
}

function handleSkillQueryKey(
  event: React.KeyboardEvent<HTMLDivElement>,
  ctx: {
    filteredSkills: AttachedSkill[];
    selectedSkillIndex: number;
    setSelectedSkillIndex: React.Dispatch<React.SetStateAction<number>>;
    setSkillQuery: React.Dispatch<React.SetStateAction<string | null>>;
    skillRangeRef: React.MutableRefObject<unknown>;
    selectSkill: (skill: AttachedSkill) => void;
  }
): boolean {
  if (event.key === "Escape") {
    event.preventDefault();
    ctx.setSkillQuery(null);
    ctx.skillRangeRef.current = null;
    return true;
  }

  if (event.key === "ArrowDown" && ctx.filteredSkills.length > 0) {
    event.preventDefault();
    ctx.setSelectedSkillIndex((current) => Math.min(current + 1, ctx.filteredSkills.length - 1));
    return true;
  }

  if (event.key === "ArrowUp" && ctx.filteredSkills.length > 0) {
    event.preventDefault();
    ctx.setSelectedSkillIndex((current) => Math.max(current - 1, 0));
    return true;
  }

  if (event.key === "Enter" && !event.shiftKey && ctx.filteredSkills.length > 0) {
    event.preventDefault();
    const selectedSkill = ctx.filteredSkills[ctx.selectedSkillIndex] ?? ctx.filteredSkills[0];
    if (selectedSkill) ctx.selectSkill(selectedSkill);
    return true;
  }

  return false;
}

function handleCommandMenuKey(params: {
  commandItems: ChatInsertCommandItem[];
  commandScope: InsertCommandScope | null;
  event: React.KeyboardEvent<HTMLDivElement>;
  onSelect: (item: ChatInsertCommandItem) => void;
  selectedCommandIndex: number;
  setCommandScope: (value: InsertCommandScope | null) => void;
  setSelectedCommandIndex: React.Dispatch<React.SetStateAction<number>>;
}): boolean {
  if (params.commandScope === null) return false;

  if (params.event.key === "Escape") {
    params.event.preventDefault();
    params.setCommandScope(null);
    return true;
  }

  if (params.event.key === "ArrowDown" && params.commandItems.length > 0) {
    params.event.preventDefault();
    params.setSelectedCommandIndex((current) =>
      Math.min(current + 1, params.commandItems.length - 1)
    );
    return true;
  }

  if (params.event.key === "ArrowUp" && params.commandItems.length > 0) {
    params.event.preventDefault();
    params.setSelectedCommandIndex((current) => Math.max(current - 1, 0));
    return true;
  }

  if (params.event.key === "Enter" && !params.event.shiftKey) {
    params.event.preventDefault();
    const selectedItem = params.commandItems[params.selectedCommandIndex] ?? params.commandItems[0];
    if (selectedItem) {
      params.onSelect(selectedItem);
    }
    return true;
  }

  return false;
}

const TEXT_EXTENSIONS = new Set([
  "txt",
  "md",
  "markdown",
  "csv",
  "json",
  "jsonl",
  "yaml",
  "yml",
  "toml",
  "xml",
  "html",
  "htm",
  "css",
  "js",
  "ts",
  "tsx",
  "jsx",
  "py",
  "rb",
  "go",
  "rs",
  "java",
  "swift",
  "kt",
  "sh",
  "bash",
  "zsh",
  "env",
  "log",
  "sql",
  "graphql",
  "gql",
]);

function isTextFile(file: File): boolean {
  if (file.type.startsWith("text/")) return true;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return TEXT_EXTENSIONS.has(ext);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function buildAttachedFileMarkdown(text: string, files: AttachedFile[]): string {
  let fullText = text;
  for (const file of files) {
    const lang = file.name.split(".").pop() ?? "";
    fullText += `\n\n**Attached: ${file.name}**\n\`\`\`${lang}\n${file.content}\n\`\`\``;
  }
  return fullText;
}

function ChatComposerPanels({
  activeProject,
  attachedContextItems,
  attachedFiles,
  attachedImages,
  attachedSkills,
  commandGroups,
  commandScope,
  filteredSlugs,
  filteredSkills,
  insertData,
  mentionQuery,
  skillQuery,
  onRemoveFile,
  onRemoveImage,
  onRemoveContext,
  onRemoveSkill,
  onSelectCommand,
  onSelectInsertItem,
  onSelectMention,
  onSelectSkill,
  pinnedProject,
  selectedCommandIndex,
  selectedSkillIndex,
  selectedMode,
  setPinnedProject,
  showInsertMenu,
}: {
  activeProject: string | null;
  attachedContextItems: AttachedContextItem[];
  attachedFiles: AttachedFile[];
  attachedImages: AttachedImage[];
  attachedSkills: AttachedSkill[];
  commandGroups: ReturnType<typeof buildInsertCommandGroups>;
  commandScope: InsertCommandScope | null;
  filteredSlugs: string[];
  filteredSkills: AttachedSkill[];
  insertData: ReturnType<typeof useChatInsertData>;
  mentionQuery: string | null;
  skillQuery: string | null;
  onRemoveFile: (fileId: string) => void;
  onRemoveImage: (imageId: string) => void;
  onRemoveContext: (contextKey: string) => void;
  onRemoveSkill: (skillId: string) => void;
  onSelectCommand: (item: (typeof commandGroups)[number]["items"][number]) => void;
  onSelectInsertItem: (item: ChatInsertCommandItem) => void;
  onSelectMention: (slug: string) => void;
  onSelectSkill: (skill: AttachedSkill) => void;
  pinnedProject: string | null;
  selectedCommandIndex: number;
  selectedSkillIndex: number;
  selectedMode: ReturnType<typeof useChatContext>["selectedMode"];
  setPinnedProject: (slug: string | null) => void;
  showInsertMenu: boolean;
}) {
  return (
    <>
      {(pinnedProject ||
        selectedMode !== "default" ||
        attachedSkills.length > 0 ||
        attachedContextItems.length > 0) && (
        <div className="mb-1.5 flex flex-wrap items-center gap-1">
          <span className="inline-flex items-center gap-1 rounded-item bg-accent/10 px-1.5 py-0.5 font-mono text-accent/70 text-w-sm">
            {getAssistantModeLabel(selectedMode)}
          </span>
          {Boolean(pinnedProject) && (
            <span className="inline-flex items-center gap-1 rounded-item bg-accent/10 px-1.5 py-0.5 font-mono text-accent/70 text-w-sm">
              @{pinnedProject}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setPinnedProject(null)}
                className="icon-xs uppercase-none p-0 text-dim transition-colors hover:bg-transparent hover:text-foreground"
                aria-label="Remove pinned project"
              >
                <XIcon size={9} />
              </Button>
            </span>
          )}
          {attachedSkills.map((skill) => (
            <span
              key={skill.id}
              className="inline-flex items-center gap-1 rounded-item bg-accent/10 px-1.5 py-0.5 font-mono text-accent/70 text-w-sm"
            >
              ${skill.name}
              <span className="rounded-item bg-accent/10 px-1 py-[1px] text-accent/60 text-w-sm uppercase tracking-widest">
                {skill.builtin ? "built-in" : "custom"}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onRemoveSkill(skill.id)}
                className="icon-xs uppercase-none p-0 text-dim transition-colors hover:bg-transparent hover:text-foreground"
                aria-label={`Remove ${skill.name} skill`}
              >
                <XIcon size={9} />
              </Button>
            </span>
          ))}
          {attachedContextItems.map((item) => (
            <span
              key={getAttachedContextKey(item)}
              className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-item bg-accent/10 px-1.5 py-0.5 font-mono text-accent/70 text-w-sm"
            >
              <span className="text-accent/60 text-w-sm uppercase tracking-widest">
                {item.kind === "runtime" ? item.item.kind : item.kind}
              </span>
              <span className="max-w-[180px] truncate">{item.title}</span>
              {item.badge ? (
                <span className="truncate rounded-item bg-accent/10 px-1 py-[1px] text-accent/60 text-w-sm uppercase tracking-widest">
                  {item.badge}
                </span>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onRemoveContext(getAttachedContextKey(item))}
                className="icon-xs uppercase-none p-0 text-dim transition-colors hover:bg-transparent hover:text-foreground"
                aria-label={`Remove ${item.title} ${item.kind}`}
              >
                <XIcon size={9} />
              </Button>
            </span>
          ))}
        </div>
      )}

      {mentionQuery !== null && filteredSlugs.length > 0 && (
        <div className="mb-1 overflow-hidden rounded-item border border-border bg-surface font-mono text-w-sm shadow-xl">
          {filteredSlugs.slice(0, 6).map((slug) => (
            <Button
              key={slug}
              type="button"
              variant="ghost"
              onMouseDown={(event) => {
                event.preventDefault();
                onSelectMention(slug);
              }}
              className="uppercase-none h-auto w-full justify-start rounded-none px-3 py-1.5 text-left font-normal text-dim transition-colors hover:bg-muted hover:text-foreground-secondary"
            >
              @{slug}
            </Button>
          ))}
        </div>
      )}

      {skillQuery !== null && filteredSkills.length > 0 && (
        <div className="mb-1 overflow-hidden rounded-item border border-border bg-surface font-mono text-w-sm shadow-xl">
          {filteredSkills.slice(0, 6).map((skill, index) => (
            <Button
              key={skill.id}
              type="button"
              variant="ghost"
              onMouseDown={(event) => {
                event.preventDefault();
                onSelectSkill(skill);
              }}
              className={cn(
                "uppercase-none h-auto w-full flex-col items-start rounded-none px-3 py-1.5 text-left font-normal transition-colors",
                index === selectedSkillIndex
                  ? "bg-muted text-foreground-secondary"
                  : "text-dim hover:bg-muted hover:text-foreground-secondary"
              )}
            >
              <span className="flex items-center gap-2">
                <span className="truncate font-medium">${skill.name}</span>
                <span className="rounded-item bg-accent/10 px-1 py-[1px] text-accent/60 text-w-sm uppercase tracking-widest">
                  {skill.builtin ? "built-in" : "custom"}
                </span>
              </span>
              <span className="block truncate text-dim/70 text-w-sm">{skill.description}</span>
            </Button>
          ))}
        </div>
      )}

      {commandScope !== null && (
        <ChatCommandMenu
          groups={commandGroups}
          loading={insertData.loading}
          scope={commandScope}
          selectedIndex={selectedCommandIndex}
          onSelect={onSelectCommand}
        />
      )}

      {Boolean(showInsertMenu) && (
        <ChatInsertMenu
          activeProject={activeProject}
          data={insertData}
          onSelect={onSelectInsertItem}
        />
      )}

      {(attachedImages.length > 0 || attachedFiles.length > 0) && (
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {attachedImages.map((image) => (
            <div key={image.id} className="group/att relative">
              <div
                role="img"
                aria-label={image.name}
                className="h-12 w-12 rounded-item border border-border object-cover"
                style={{
                  backgroundImage: `url("${image.dataUrl}")`,
                  backgroundPosition: "center",
                  backgroundRepeat: "no-repeat",
                  backgroundSize: "cover",
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onRemoveImage(image.id)}
                aria-label="Remove image"
                className="icon-sm uppercase-none absolute -top-1 -right-1 hidden items-center justify-center rounded-full border border-border bg-surface p-0 text-dim transition-colors hover:bg-transparent hover:text-destructive group-hover/att:flex"
              >
                <XIcon size={8} />
              </Button>
            </div>
          ))}

          {attachedFiles.map((file) => (
            <div
              key={file.id}
              className="group/att relative flex h-12 max-w-[140px] items-center gap-1 rounded-item border border-border bg-surface px-2 font-mono text-w-sm"
            >
              <FileTextIcon size={12} className="shrink-0 text-dim" />
              <div className="min-w-0">
                <p className="truncate text-foreground-secondary leading-tight">{file.name}</p>
                <p className="text-dim opacity-60">{formatBytes(file.size)}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onRemoveFile(file.id)}
                aria-label="Remove file"
                className="icon-sm uppercase-none absolute -top-1 -right-1 hidden items-center justify-center rounded-full border border-border bg-surface p-0 text-dim transition-colors hover:bg-transparent hover:text-destructive group-hover/att:flex"
              >
                <XIcon size={8} />
              </Button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function ChatComposerStreamingStatus({ isAwaitingFirstToken }: { isAwaitingFirstToken: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 border-border/30 border-t bg-muted/10 px-5 py-2 font-mono text-dim text-w-xs uppercase tracking-wider"
    >
      {isAwaitingFirstToken ? (
        <>
          <Loader2Icon className="icon-xs shrink-0 animate-spin text-accent" aria-hidden />
          <span>Waiting for response</span>
        </>
      ) : (
        <>
          <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent" aria-hidden />
          <span>Generating</span>
        </>
      )}
    </div>
  );
}

function ChatComposerUnavailableState() {
  return (
    <div className="flex items-center justify-center border-border border-t bg-surface px-4 py-6">
      <p className="font-mono text-dim text-w-sm">
        AI assistant is available after connecting your services.
      </p>
    </div>
  );
}

function ChatComposerFooter({
  handleFilePick,
  handleSubmit,
  isEmpty,
  isStreaming,
  selectedMode,
  setShowInsertMenu,
  stop,
}: {
  handleFilePick: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleSubmit: () => Promise<void>;
  isEmpty: boolean;
  isStreaming: boolean;
  selectedMode: ReturnType<typeof useChatContext>["selectedMode"];
  setShowInsertMenu: React.Dispatch<React.SetStateAction<boolean>>;
  stop: () => void;
}) {
  return (
    <PromptInputFooter>
      <PromptInputTools>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setShowInsertMenu((open) => !open)}
              className="uppercase-none h-8 w-8 p-0 text-dim/40 transition-colors hover:bg-accent/5 hover:text-accent"
              aria-label="Insert context"
            >
              <PlusIcon size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Insert saved context</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Label
              className="mb-0 block cursor-pointer rounded-none p-1.5 text-dim/40 transition-colors hover:bg-accent/5 hover:text-accent"
              aria-label="Attach file"
            >
              <ImageIcon size={16} />
              <input
                type="file"
                accept="image/*,text/*,.json,.jsonl,.yaml,.yml,.toml,.csv,.md,.ts,.tsx,.js,.jsx,.py,.go,.rs,.rb,.java,.swift,.kt,.sh,.sql,.graphql,.gql,.log,.env"
                multiple
                className="sr-only"
                onChange={handleFilePick}
              />
            </Label>
          </TooltipTrigger>
          <TooltipContent>Attach files (or paste)</TooltipContent>
        </Tooltip>
        <div className="mx-1 h-4 w-[1px] bg-border/20" />
        <ChatModeSelector />
        <div className="h-4 w-[1px] bg-border/20" />
        <ChatModelSelector />
        {selectedMode === "review" ? (
          <>
            <div className="h-4 w-[1px] bg-border/20" />
            <ChatChallengerSelector />
          </>
        ) : null}
      </PromptInputTools>

      <div className="flex items-center gap-2">
        {isStreaming ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={stop}
            aria-label="Stop generation"
            className="uppercase-none h-9 w-9 rounded-none p-0 text-destructive transition-colors hover:bg-destructive/10"
          >
            <SquareIcon size={14} fill="currentColor" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={() => handleSubmit()}
            aria-label="Send message"
            disabled={isEmpty}
            className="uppercase-none h-9 w-9 rounded-none bg-accent p-0 text-white shadow-sm transition-all hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-10"
          >
            <ArrowUpIcon size={18} strokeWidth={3} />
          </Button>
        )}
      </div>
    </PromptInputFooter>
  );
}

function ChatComposerEditor({
  composerRef,
  composerValue,
  handleComposerChange,
  handleEditorKeyDown,
  handleEditorPaste,
  isStreaming,
}: {
  composerRef: React.RefObject<RichTextComposerHandle | null>;
  composerValue: string;
  handleComposerChange: (nextValue: string, meta: RichTextComposerChangeMeta) => void;
  handleEditorKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => boolean;
  handleEditorPaste: (
    event: React.ClipboardEvent<HTMLDivElement>,
    meta: { editor: RichTextComposerChangeMeta["editor"] }
  ) => boolean;
  isStreaming: boolean;
}) {
  return (
    <PromptInputBody>
      <RichTextComposer
        ref={composerRef}
        value={composerValue}
        onChange={handleComposerChange}
        onKeyDown={handleEditorKeyDown}
        onPaste={handleEditorPaste}
        disabled={isStreaming}
        placeholder="Ask anything… (@ project, $ skill, paste files)"
        showToolbar={false}
        className="relative rounded-none border-0 bg-transparent"
        editorClassName="min-h-[80px] px-4 pb-4 pt-4 text-w-sm leading-relaxed text-foreground placeholder:text-dim/40"
        contentClassName="max-h-[400px]"
      />
    </PromptInputBody>
  );
}

function ChatComposerPresets({
  attachedContextItems,
  attachedFiles,
  attachedImages,
  attachedSkills,
  composerValue,
  isStreaming,
  onSelect,
}: {
  attachedContextItems: AttachedContextItem[];
  attachedFiles: AttachedFile[];
  attachedImages: AttachedImage[];
  attachedSkills: AttachedSkill[];
  composerValue: string;
  isStreaming: boolean;
  onSelect: (preset: {
    prompt: string;
    mode: ReturnType<typeof useChatContext>["selectedMode"];
    modelId: string | null;
  }) => void;
}) {
  const shouldShow =
    !isStreaming &&
    composerValue.trim().length === 0 &&
    attachedImages.length === 0 &&
    attachedFiles.length === 0 &&
    attachedSkills.length === 0 &&
    attachedContextItems.length === 0;

  return shouldShow ? <ChatPresetChips onSelect={onSelect} /> : null;
}

function useChatComposerUiState() {
  const [composerValue, setComposerValue] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [skillQuery, setSkillQuery] = useState<string | null>(null);
  const [commandQuery, setCommandQuery] = useState("");
  const [commandScope, setCommandScope] = useState<InsertCommandScope | null>(null);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [selectedSkillIndex, setSelectedSkillIndex] = useState(0);
  const [attachedContextItems, setAttachedContextItems] = useState<AttachedContextItem[]>([]);
  const [attachedSkills, setAttachedSkills] = useState<AttachedSkill[]>([]);
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [showInsertMenu, setShowInsertMenu] = useState(false);

  return {
    attachedContextItems,
    attachedFiles,
    attachedImages,
    attachedSkills,
    commandQuery,
    commandScope,
    composerValue,
    mentionQuery,
    selectedCommandIndex,
    selectedSkillIndex,
    setAttachedContextItems,
    setAttachedFiles,
    setAttachedImages,
    setAttachedSkills,
    setCommandQuery,
    setCommandScope,
    setComposerValue,
    setMentionQuery,
    setSelectedCommandIndex,
    setSelectedSkillIndex,
    setShowInsertMenu,
    setSkillQuery,
    showInsertMenu,
    skillQuery,
  };
}

type PendingAssistantHandoffState = {
  nonce: number;
  items: AssistantHandoffItem[];
  promptText?: string | null;
} | null;

function usePendingAssistantHandoffSync({
  composerRef,
  composerValue,
  pendingAssistantHandoff,
  setAttachedContextItems,
  setComposerValue,
}: {
  composerRef: React.RefObject<RichTextComposerHandle | null>;
  composerValue: string;
  pendingAssistantHandoff: PendingAssistantHandoffState;
  setAttachedContextItems: React.Dispatch<React.SetStateAction<AttachedContextItem[]>>;
  setComposerValue: React.Dispatch<React.SetStateAction<string>>;
}) {
  const consumedAssistantHandoffNonceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!pendingAssistantHandoff) return;
    if (consumedAssistantHandoffNonceRef.current === pendingAssistantHandoff.nonce) return;

    consumedAssistantHandoffNonceRef.current = pendingAssistantHandoff.nonce;
    setAttachedContextItems((prev) => {
      const merged = [
        ...prev,
        ...pendingAssistantHandoff.items.map((item) => toAttachedRuntimeContextItem(item)),
      ];
      return [
        ...new Map(merged.map((item) => [getAttachedContextKey(item), item] as const)).values(),
      ];
    });

    if (pendingAssistantHandoff.promptText) {
      const trimmed = pendingAssistantHandoff.promptText.trim();
      if (trimmed) {
        const nextValue =
          composerValue.trim().length === 0 ? trimmed : `${composerValue.trimEnd()}\n\n${trimmed}`;
        setComposerValue(nextValue);
        composerRef.current?.setMarkdown(nextValue);
      }
    }

    chatActions.clearPendingAssistantHandoff();
    composerRef.current?.focus();
  }, [
    composerRef,
    composerValue,
    pendingAssistantHandoff,
    setAttachedContextItems,
    setComposerValue,
  ]);
}

function useComposerRegistration(
  composerRef: React.RefObject<RichTextComposerHandle | null>,
  registerComposerRef: (composer: RichTextComposerHandle | null) => void
) {
  useEffect(() => {
    registerComposerRef(composerRef.current);
    return () => registerComposerRef(null);
  }, [composerRef, registerComposerRef]);
}

function useRestoreSavedInputOnError({
  composerValue,
  error,
  savedInputRef,
  setComposerValue,
}: {
  composerValue: string;
  error: unknown;
  savedInputRef: React.MutableRefObject<string>;
  setComposerValue: React.Dispatch<React.SetStateAction<string>>;
}) {
  useEffect(() => {
    if (!error || !savedInputRef.current || composerValue.trim().length > 0) return;
    setComposerValue(savedInputRef.current);
    savedInputRef.current = "";
  }, [composerValue, error, savedInputRef, setComposerValue]);
}

function useChatComposerLookupData({
  activeProject,
  activeThreadId,
  attachedSkills,
  mentionQuery,
  projectSlugs,
  searchEnabled,
  showInsertMenu,
  skillQuery,
}: {
  activeProject: string | null;
  activeThreadId: string | null;
  attachedSkills: AttachedSkill[];
  mentionQuery: string | null;
  projectSlugs: string[];
  searchEnabled: boolean;
  showInsertMenu: boolean;
  skillQuery: string | null;
}) {
  const insertData = useChatInsertData(
    activeProject,
    activeThreadId,
    showInsertMenu || searchEnabled
  );
  const { data: availableSkills = [] } = useSWR<AttachedSkill[]>(
    skillQuery !== null ? buildApiRoute(API_ROUTES.chatSkills, { scope: "composer" }) : null,
    fetchComposerSkills,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }
  );

  const filteredSlugs =
    mentionQuery !== null
      ? projectSlugs.filter((slug) => slug.toLowerCase().includes(mentionQuery.toLowerCase()))
      : [];

  const filteredSkills =
    skillQuery !== null
      ? availableSkills.filter((skill) => {
          if (attachedSkills.some((attachedSkill) => attachedSkill.id === skill.id)) return false;
          const query = skillQuery.trim().toLowerCase();
          if (!query) return true;
          return (
            skill.name.toLowerCase().includes(query) ||
            skill.description.toLowerCase().includes(query) ||
            skill.id.toLowerCase().includes(query)
          );
        })
      : [];

  return {
    filteredSkills,
    filteredSlugs,
    insertData,
  };
}

function useChatComposerFocusHotkey(composerRef: React.RefObject<RichTextComposerHandle | null>) {
  useHotkey("Mod+K", (event) => {
    event.preventDefault();
    composerRef.current?.focus();
  });
}

function useChatComposerInlineState({
  activeProject,
  clearError,
  commandQuery,
  commandRangeRef,
  commandScope,
  error,
  insertData,
  mentionRangeRef,
  setCommandQuery,
  setCommandScope,
  setComposerValue,
  setMentionQuery,
  setSelectedCommandIndex,
  setSelectedSkillIndex,
  setShowInsertMenu,
  setSkillQuery,
  skillRangeRef,
}: {
  activeProject: string | null;
  clearError: () => void;
  commandQuery: string;
  commandRangeRef: React.MutableRefObject<InlineRange | null>;
  commandScope: InsertCommandScope | null;
  error: unknown;
  insertData: ReturnType<typeof useChatInsertData>;
  mentionRangeRef: React.MutableRefObject<InlineRange | null>;
  setCommandQuery: React.Dispatch<React.SetStateAction<string>>;
  setCommandScope: React.Dispatch<React.SetStateAction<InsertCommandScope | null>>;
  setComposerValue: React.Dispatch<React.SetStateAction<string>>;
  setMentionQuery: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedCommandIndex: React.Dispatch<React.SetStateAction<number>>;
  setSelectedSkillIndex: React.Dispatch<React.SetStateAction<number>>;
  setShowInsertMenu: React.Dispatch<React.SetStateAction<boolean>>;
  setSkillQuery: React.Dispatch<React.SetStateAction<string | null>>;
  skillRangeRef: React.MutableRefObject<InlineRange | null>;
}) {
  const updateMentionState = useCallback(
    (meta: RichTextComposerChangeMeta) => {
      const match = /@(\w*)$/.exec(meta.textBeforeCursor);
      if (!match) {
        mentionRangeRef.current = null;
        setMentionQuery(null);
        return;
      }

      mentionRangeRef.current = {
        from: meta.selection.from - match[0].length,
        to: meta.selection.from,
      };
      setMentionQuery(match[1] ?? "");
    },
    [mentionRangeRef, setMentionQuery]
  );

  const updateSkillState = useCallback(
    (meta: RichTextComposerChangeMeta) => {
      const match = /\$([\w-]*)$/.exec(meta.textBeforeCursor);
      if (!match) {
        skillRangeRef.current = null;
        setSkillQuery(null);
        return;
      }

      skillRangeRef.current = {
        from: meta.selection.from - match[0].length,
        to: meta.selection.from,
      };
      setSkillQuery(match[1] ?? "");
      setSelectedSkillIndex(0);
    },
    [setSelectedSkillIndex, setSkillQuery, skillRangeRef]
  );

  const updateCommandState = useCallback(
    (meta: RichTextComposerChangeMeta) => {
      const match = parseInsertCommand(meta.textBeforeCursor, meta.selection.from);
      if (!match) {
        commandRangeRef.current = null;
        setCommandScope(null);
        setCommandQuery("");
        return;
      }
      commandRangeRef.current = {
        from: match.from,
        to: match.to,
      };
      setCommandScope(match.scope);
      setCommandQuery(match.query);
      setSelectedCommandIndex(0);
      setShowInsertMenu(false);
    },
    [commandRangeRef, setCommandQuery, setCommandScope, setSelectedCommandIndex, setShowInsertMenu]
  );

  const commandItems = useMemo(() => {
    if (commandScope === null) return [];
    return filterInsertCommandItems(activeProject, insertData, commandScope, commandQuery);
  }, [activeProject, commandQuery, commandScope, insertData]);

  const commandGroups = useMemo(
    () => buildInsertCommandGroups(commandItems, commandScope ?? "all"),
    [commandItems, commandScope]
  );

  const handleComposerChange = useCallback(
    (nextValue: string, meta: RichTextComposerChangeMeta) => {
      if (error) clearError();
      setComposerValue(nextValue);
      updateMentionState(meta);
      updateSkillState(meta);
      updateCommandState(meta);
    },
    [clearError, error, setComposerValue, updateCommandState, updateMentionState, updateSkillState]
  );

  return {
    commandGroups,
    commandItems,
    handleComposerChange,
  };
}

function useChatComposerAttachments({
  clearError,
  error,
  setAttachedFiles,
  setAttachedImages,
}: {
  clearError: () => void;
  error: unknown;
  setAttachedFiles: React.Dispatch<React.SetStateAction<AttachedFile[]>>;
  setAttachedImages: React.Dispatch<React.SetStateAction<AttachedImage[]>>;
}) {
  const addImageFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (!dataUrl) return;
        if (error) clearError();
        setAttachedImages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), dataUrl, mimeType: file.type, name: file.name },
        ]);
      };
      reader.readAsDataURL(file);
    },
    [clearError, error, setAttachedImages]
  );

  const addTextFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content == null) return;
        if (error) clearError();
        setAttachedFiles((prev) => [
          ...prev,
          { id: crypto.randomUUID(), name: file.name, content, size: file.size },
        ]);
      };
      reader.readAsText(file);
    },
    [clearError, error, setAttachedFiles]
  );

  const processFile = useCallback(
    (file: File) => {
      if (file.type.startsWith("image/")) {
        addImageFile(file);
      } else if (isTextFile(file)) {
        addTextFile(file);
      }
    },
    [addImageFile, addTextFile]
  );

  const handleFilePick = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      for (const file of Array.from(event.target.files ?? [])) {
        processFile(file);
      }
      event.target.value = "";
    },
    [processFile]
  );

  const handleEditorPaste = useCallback(
    (
      event: React.ClipboardEvent<HTMLDivElement>,
      meta: { editor: RichTextComposerChangeMeta["editor"] }
    ) => {
      const imageItems = Array.from(event.clipboardData.items).filter((item) =>
        item.type.startsWith("image/")
      );
      if (imageItems.length === 0) return false;

      event.preventDefault();
      if (error) clearError();

      const pastedText = event.clipboardData.getData("text/plain");
      if (pastedText) {
        meta.editor.chain().focus().insertContent(pastedText).run();
      }

      for (const item of imageItems) {
        const file = item.getAsFile();
        if (file) addImageFile(file);
      }

      return true;
    },
    [addImageFile, clearError, error]
  );

  const removeImage = useCallback(
    (imageId: string) => {
      setAttachedImages((prev) => prev.filter((image) => image.id !== imageId));
    },
    [setAttachedImages]
  );

  const removeFile = useCallback(
    (fileId: string) => {
      setAttachedFiles((prev) => prev.filter((file) => file.id !== fileId));
    },
    [setAttachedFiles]
  );

  return {
    handleEditorPaste,
    handleFilePick,
    removeFile,
    removeImage,
  };
}

function useChatComposerInsertActions({
  clearError,
  commandRangeRef,
  composerRef,
  composerValue,
  error,
  setAttachedContextItems,
  setAttachedSkills,
  setCommandQuery,
  setCommandScope,
  setMentionQuery,
  setPinnedProject,
  setSelectedSkillIndex,
  setShowInsertMenu,
  setSkillQuery,
  skillRangeRef,
}: {
  clearError: () => void;
  commandRangeRef: React.MutableRefObject<InlineRange | null>;
  composerRef: React.RefObject<RichTextComposerHandle | null>;
  composerValue: string;
  error: unknown;
  setAttachedContextItems: React.Dispatch<React.SetStateAction<AttachedContextItem[]>>;
  setAttachedSkills: React.Dispatch<React.SetStateAction<AttachedSkill[]>>;
  setCommandQuery: React.Dispatch<React.SetStateAction<string>>;
  setCommandScope: React.Dispatch<React.SetStateAction<InsertCommandScope | null>>;
  setMentionQuery: React.Dispatch<React.SetStateAction<string | null>>;
  setPinnedProject: (slug: string | null) => void;
  setSelectedSkillIndex: React.Dispatch<React.SetStateAction<number>>;
  setShowInsertMenu: React.Dispatch<React.SetStateAction<boolean>>;
  setSkillQuery: React.Dispatch<React.SetStateAction<string | null>>;
  skillRangeRef: React.MutableRefObject<InlineRange | null>;
}) {
  const selectMention = useCallback(
    (slug: string) => {
      const replacement = `@${slug} `;
      const range = commandRangeRef.current;

      if (range) composerRef.current?.replaceRange(range.from, range.to, replacement);
      else composerRef.current?.insertText(replacement);

      commandRangeRef.current = null;
      setMentionQuery(null);
      setPinnedProject(slug);
      composerRef.current?.focus();
    },
    [commandRangeRef, composerRef, setMentionQuery, setPinnedProject]
  );

  const selectSkill = useCallback(
    (skill: AttachedSkill) => {
      if (error) clearError();
      const range = skillRangeRef.current;

      if (range) {
        composerRef.current?.replaceRange(range.from, range.to, "");
      }

      setAttachedSkills((prev) => {
        if (prev.some((attachedSkill) => attachedSkill.id === skill.id)) return prev;
        return [...prev, skill];
      });
      skillRangeRef.current = null;
      setSkillQuery(null);
      setSelectedSkillIndex(0);
      composerRef.current?.focus();
    },
    [
      clearError,
      composerRef,
      error,
      setAttachedSkills,
      setSelectedSkillIndex,
      setSkillQuery,
      skillRangeRef,
    ]
  );

  const attachContextItem = useCallback(
    (item: ChatInsertCommandItem) => {
      const attachment = item.attachment;
      if (!attachment) return;
      if (error) clearError();

      if (commandRangeRef.current) {
        composerRef.current?.replaceRange(
          commandRangeRef.current.from,
          commandRangeRef.current.to,
          ""
        );
      }

      setAttachedContextItems((prev) => {
        if (
          prev.some(
            (attachedItem) =>
              attachedItem.id === attachment.id && attachedItem.kind === attachment.type
          )
        ) {
          return prev;
        }

        return [
          ...prev,
          {
            id: attachment.id,
            kind: attachment.type,
            title: item.title,
            badge: item.badge,
          },
        ];
      });

      composerRef.current?.focus();
      setShowInsertMenu(false);
      setCommandScope(null);
      setCommandQuery("");
      commandRangeRef.current = null;
    },
    [
      clearError,
      commandRangeRef,
      composerRef,
      error,
      setAttachedContextItems,
      setCommandQuery,
      setCommandScope,
      setShowInsertMenu,
    ]
  );

  const insertSnippet = useCallback(
    (snippet: string) => {
      const trimmed = snippet.trim();
      if (!trimmed) return;
      if (error) clearError();
      const commandRange = commandRangeRef.current;

      if (commandRange) {
        composerRef.current?.replaceRange(commandRange.from, commandRange.to, trimmed);
      } else {
        const prefix = composerValue.trim().length > 0 ? "\n\n" : "";
        composerRef.current?.insertText(`${prefix}${trimmed}`);
      }

      composerRef.current?.focus();
      setShowInsertMenu(false);
      setCommandScope(null);
      setCommandQuery("");
      commandRangeRef.current = null;
    },
    [
      clearError,
      commandRangeRef,
      composerRef,
      composerValue,
      error,
      setCommandQuery,
      setCommandScope,
      setShowInsertMenu,
    ]
  );

  const handleInsertItem = useCallback(
    (item: ChatInsertCommandItem) => {
      if (item.action === "attach") {
        attachContextItem(item);
        return;
      }

      insertSnippet(item.insertText);
    },
    [attachContextItem, insertSnippet]
  );

  return {
    handleInsertItem,
    selectMention,
    selectSkill,
  };
}

function useChatComposerUiActions({
  commandItems,
  commandRangeRef,
  commandScope,
  composerRef,
  composerValue,
  editLastUserMessage,
  filteredSkills,
  filteredSlugsLength,
  handleInsertItem,
  handleSubmit,
  mentionQuery,
  mentionRangeRef,
  selectSkill,
  selectedCommandIndex,
  selectedMode,
  selectedSkillIndex,
  setAttachedContextItems,
  setAttachedSkills,
  setCommandQuery,
  setCommandScope,
  setComposerValue,
  setMentionQuery,
  setPinnedProject,
  setSelectedCommandIndex,
  setSelectedSkillIndex,
  setSkillQuery,
  setSelectedModel,
  setSelectedMode,
  skillQuery,
  skillRangeRef,
}: {
  commandItems: ChatInsertCommandItem[];
  commandRangeRef: React.MutableRefObject<InlineRange | null>;
  commandScope: InsertCommandScope | null;
  composerRef: React.RefObject<RichTextComposerHandle | null>;
  composerValue: string;
  editLastUserMessage: () => void;
  filteredSkills: AttachedSkill[];
  filteredSlugsLength: number;
  handleInsertItem: (item: ChatInsertCommandItem) => void;
  handleSubmit: () => Promise<void>;
  mentionQuery: string | null;
  mentionRangeRef: React.MutableRefObject<InlineRange | null>;
  selectSkill: (skill: AttachedSkill) => void;
  selectedCommandIndex: number;
  selectedMode: ReturnType<typeof useChatContext>["selectedMode"];
  selectedSkillIndex: number;
  setAttachedContextItems: React.Dispatch<React.SetStateAction<AttachedContextItem[]>>;
  setAttachedSkills: React.Dispatch<React.SetStateAction<AttachedSkill[]>>;
  setCommandQuery: React.Dispatch<React.SetStateAction<string>>;
  setCommandScope: React.Dispatch<React.SetStateAction<InsertCommandScope | null>>;
  setComposerValue: React.Dispatch<React.SetStateAction<string>>;
  setMentionQuery: React.Dispatch<React.SetStateAction<string | null>>;
  setPinnedProject: (slug: string | null) => void;
  setSelectedCommandIndex: React.Dispatch<React.SetStateAction<number>>;
  setSelectedSkillIndex: React.Dispatch<React.SetStateAction<number>>;
  setSelectedModel: (modelId: string | null) => void;
  setSelectedMode: (mode: ReturnType<typeof useChatContext>["selectedMode"]) => void;
  setSkillQuery: React.Dispatch<React.SetStateAction<string | null>>;
  skillQuery: string | null;
  skillRangeRef: React.MutableRefObject<InlineRange | null>;
}) {
  const handleEditorKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const commandHandled = handleCommandMenuKey({
        commandItems,
        commandScope,
        event,
        onSelect: handleInsertItem,
        selectedCommandIndex,
        setCommandScope,
        setSelectedCommandIndex,
      });
      if (commandHandled) {
        if (commandScope !== null && event.key === "Escape") {
          commandRangeRef.current = null;
          setCommandQuery("");
        }
        return true;
      }

      if (
        handleMentionEscape(
          event,
          mentionQuery,
          filteredSlugsLength,
          setMentionQuery,
          mentionRangeRef
        )
      ) {
        return true;
      }

      if (skillQuery !== null) {
        const handled = handleSkillQueryKey(event, {
          filteredSkills,
          selectedSkillIndex,
          setSelectedSkillIndex,
          setSkillQuery,
          skillRangeRef,
          selectSkill,
        });
        if (handled) return true;
      }

      return handleGlobalKeys(event, composerValue, handleSubmit, editLastUserMessage);
    },
    [
      commandItems,
      commandScope,
      composerValue,
      editLastUserMessage,
      filteredSkills,
      filteredSlugsLength,
      handleInsertItem,
      handleSubmit,
      mentionQuery,
      mentionRangeRef,
      selectSkill,
      selectedCommandIndex,
      selectedSkillIndex,
      setCommandQuery,
      setCommandScope,
      setMentionQuery,
      setSelectedCommandIndex,
      setSelectedSkillIndex,
      setSkillQuery,
      skillQuery,
      skillRangeRef,
    ]
  );

  const removeContext = useCallback(
    (contextKey: string) => {
      setAttachedContextItems((prev) =>
        prev.filter((item) => getAttachedContextKey(item) !== contextKey)
      );
    },
    [setAttachedContextItems]
  );

  const removeSkill = useCallback(
    (skillId: string) => {
      setAttachedSkills((prev) => prev.filter((skill) => skill.id !== skillId));
    },
    [setAttachedSkills]
  );

  const applyStarterPreset = useCallback(
    (preset: { prompt: string; mode: typeof selectedMode; modelId: string | null }) => {
      setSelectedMode(preset.mode);
      setSelectedModel(preset.modelId);
      setComposerValue(preset.prompt);
      composerRef.current?.setMarkdown(preset.prompt);
      composerRef.current?.focus();
    },
    [composerRef, selectedMode, setComposerValue, setSelectedMode, setSelectedModel]
  );

  const removePinnedProject = useCallback(() => {
    setPinnedProject(null);
  }, [setPinnedProject]);

  return {
    applyStarterPreset,
    handleEditorKeyDown,
    removeContext,
    removePinnedProject,
    removeSkill,
  };
}

export function ChatComposer({
  conversationId: _conversationId,
}: {
  conversationId: string | null;
}) {
  const {
    ensureThread,
    session,
    registerComposerRef,
    threads,
    activeThreadId,
    selectedMode,
    setSelectedMode,
    setSelectedModel,
    pinnedProject,
    setPinnedProject,
    editLastUserMessage,
  } = useChatContext();
  const { sendMessage, stop, status, error, clearError } = session;
  const composerRef = useRef<RichTextComposerHandle>(null);
  const savedInputRef = useRef<string>("");
  const mentionRangeRef = useRef<InlineRange | null>(null);
  const skillRangeRef = useRef<InlineRange | null>(null);
  const commandRangeRef = useRef<InlineRange | null>(null);
  const {
    attachedContextItems,
    attachedFiles,
    attachedImages,
    attachedSkills,
    commandQuery,
    commandScope,
    composerValue,
    mentionQuery,
    selectedCommandIndex,
    selectedSkillIndex,
    setAttachedContextItems,
    setAttachedFiles,
    setAttachedImages,
    setAttachedSkills,
    setCommandQuery,
    setCommandScope,
    setComposerValue,
    setMentionQuery,
    setSelectedCommandIndex,
    setSelectedSkillIndex,
    setShowInsertMenu,
    setSkillQuery,
    showInsertMenu,
    skillQuery,
  } = useChatComposerUiState();
  const pendingAssistantHandoff = useStore(chatStore, (state) => state.pendingAssistantHandoff);

  const isStreaming = status === "streaming" || status === "submitted";
  const isAwaitingFirstToken = status === "submitted";
  const hasAttachments = attachedImages.length > 0 || attachedFiles.length > 0;
  const isEmpty = composerValue.trim().length === 0 && !hasAttachments;
  const activeProject =
    pinnedProject ?? threads.find((thread) => thread.id === activeThreadId)?.projectSlug ?? null;
  const { data: projectSlugs = [] } = useSWR<string[]>(
    mentionQuery !== null ? API_ROUTES.chatProjects : null,
    fetchProjectSlugs,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }
  );
  const { filteredSkills, filteredSlugs, insertData } = useChatComposerLookupData({
    activeProject,
    activeThreadId,
    attachedSkills,
    mentionQuery,
    projectSlugs,
    searchEnabled: commandScope !== null,
    showInsertMenu,
    skillQuery,
  });

  useComposerRegistration(composerRef, registerComposerRef);
  usePendingAssistantHandoffSync({
    composerRef,
    composerValue,
    pendingAssistantHandoff,
    setAttachedContextItems,
    setComposerValue,
  });
  useRestoreSavedInputOnError({
    composerValue,
    error,
    savedInputRef,
    setComposerValue,
  });

  const { commandGroups, commandItems, handleComposerChange } = useChatComposerInlineState({
    activeProject,
    clearError,
    commandQuery,
    commandRangeRef,
    commandScope,
    error,
    insertData,
    mentionRangeRef,
    setCommandQuery,
    setCommandScope,
    setComposerValue,
    setMentionQuery,
    setSelectedCommandIndex,
    setSelectedSkillIndex,
    setShowInsertMenu,
    setSkillQuery,
    skillRangeRef,
  });
  const { handleEditorPaste, handleFilePick, removeFile, removeImage } = useChatComposerAttachments(
    {
      clearError,
      error,
      setAttachedFiles,
      setAttachedImages,
    }
  );
  const { handleInsertItem, selectMention, selectSkill } = useChatComposerInsertActions({
    clearError,
    commandRangeRef,
    composerRef,
    composerValue,
    error,
    setAttachedContextItems,
    setAttachedSkills,
    setCommandQuery,
    setCommandScope,
    setMentionQuery,
    setPinnedProject,
    setSelectedSkillIndex,
    setShowInsertMenu,
    setSkillQuery,
    skillRangeRef,
  });
  const handleSubmit = useCallback(async () => {
    const text = composerValue.trim();
    if ((!text && !hasAttachments) || isStreaming) return;

    const fullText = buildAttachedFileMarkdown(text, attachedFiles);
    savedInputRef.current = fullText;

    await ensureThread();
    sendMessage(
      fullText || " ",
      attachedImages.length > 0 ? attachedImages : undefined,
      attachedSkills.length > 0 || attachedContextItems.length > 0
        ? {
            skillIds: attachedSkills.map((skill) => skill.id),
            noteIds: attachedContextItems
              .filter((item) => item.kind === "note")
              .map((item) => item.id),
            artifactIds: attachedContextItems
              .filter((item) => item.kind === "artifact")
              .map((item) => item.id),
            runtimeItems: attachedContextItems
              .filter((item): item is AttachedRuntimeContextItem => item.kind === "runtime")
              .map((item) => item.item),
          }
        : undefined
    );

    setComposerValue("");
    setMentionQuery(null);
    mentionRangeRef.current = null;
    setSkillQuery(null);
    setSelectedSkillIndex(0);
    skillRangeRef.current = null;
    setCommandScope(null);
    setCommandQuery("");
    commandRangeRef.current = null;
    setAttachedContextItems([]);
    setAttachedSkills([]);
    setAttachedImages([]);
    setAttachedFiles([]);
  }, [
    attachedContextItems,
    attachedSkills,
    attachedFiles,
    attachedImages,
    composerValue,
    ensureThread,
    hasAttachments,
    isStreaming,
    sendMessage,
  ]);
  const { applyStarterPreset, handleEditorKeyDown, removeContext, removeSkill } =
    useChatComposerUiActions({
      commandItems,
      commandRangeRef,
      commandScope,
      composerRef,
      composerValue,
      editLastUserMessage,
      filteredSkills,
      filteredSlugsLength: filteredSlugs.length,
      handleInsertItem,
      handleSubmit,
      mentionQuery,
      mentionRangeRef,
      selectSkill,
      selectedCommandIndex,
      selectedMode,
      selectedSkillIndex,
      setAttachedContextItems,
      setAttachedSkills,
      setCommandQuery,
      setCommandScope,
      setComposerValue,
      setMentionQuery,
      setPinnedProject,
      setSelectedCommandIndex,
      setSelectedSkillIndex,
      setSelectedModel,
      setSelectedMode,
      setSkillQuery,
      skillQuery,
      skillRangeRef,
    });

  useChatComposerFocusHotkey(composerRef);

  const { isDemoMode } = useDemoMode();

  if (isDemoMode) {
    return <ChatComposerUnavailableState />;
  }

  return (
    <Prompt>
      <ChatComposerPresets
        attachedContextItems={attachedContextItems}
        attachedFiles={attachedFiles}
        attachedImages={attachedImages}
        attachedSkills={attachedSkills}
        composerValue={composerValue}
        isStreaming={isStreaming}
        onSelect={applyStarterPreset}
      />

      <PromptInput aria-busy={isStreaming}>
        <PromptInputHeader>
          <ChatComposerPanels
            activeProject={activeProject}
            attachedContextItems={attachedContextItems}
            attachedFiles={attachedFiles}
            attachedImages={attachedImages}
            attachedSkills={attachedSkills}
            commandGroups={commandGroups}
            commandScope={commandScope}
            filteredSlugs={filteredSlugs}
            filteredSkills={filteredSkills}
            insertData={insertData}
            mentionQuery={mentionQuery}
            skillQuery={skillQuery}
            onRemoveFile={removeFile}
            onRemoveImage={removeImage}
            onRemoveContext={removeContext}
            onRemoveSkill={removeSkill}
            onSelectCommand={handleInsertItem}
            onSelectInsertItem={handleInsertItem}
            onSelectMention={selectMention}
            onSelectSkill={selectSkill}
            pinnedProject={pinnedProject}
            selectedCommandIndex={selectedCommandIndex}
            selectedSkillIndex={selectedSkillIndex}
            selectedMode={selectedMode}
            setPinnedProject={setPinnedProject}
            showInsertMenu={showInsertMenu}
          />
        </PromptInputHeader>

        <ChatComposerEditor
          composerRef={composerRef}
          composerValue={composerValue}
          handleComposerChange={handleComposerChange}
          handleEditorKeyDown={handleEditorKeyDown}
          handleEditorPaste={handleEditorPaste}
          isStreaming={isStreaming}
        />

        {isStreaming ? (
          <ChatComposerStreamingStatus isAwaitingFirstToken={isAwaitingFirstToken} />
        ) : null}

        <ChatComposerFooter
          handleFilePick={handleFilePick}
          handleSubmit={handleSubmit}
          isEmpty={isEmpty}
          isStreaming={isStreaming}
          selectedMode={selectedMode}
          setShowInsertMenu={setShowInsertMenu}
          stop={stop}
        />
      </PromptInput>
    </Prompt>
  );
}
