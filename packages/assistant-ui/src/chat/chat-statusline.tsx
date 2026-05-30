"use client";

import { getAssistantModeLabel } from "@radarboard/assistant-core/assistant-workflows";
import { getProvider } from "@radarboard/llm/providers/registry";
import { cn } from "@radarboard/utils/cn";
import { useChatContext } from "./chat-context";

/** Tokens used vs model context window — null when unknowable. */
function getContextWindowInfo(
  selectedModel: string | null,
  totalTokens: number
): { used: number; limit: number; pct: number } | null {
  if (!selectedModel?.includes(":")) return null;
  const [providerId, modelId] = selectedModel.split(":", 2);
  if (!providerId || !modelId) return null;
  const model = getProvider(providerId)?.models.find((m) => m.id === modelId);
  if (!model?.contextWindow) return null;
  const pct = Math.min(totalTokens / model.contextWindow, 1);
  return { used: totalTokens, limit: model.contextWindow, pct };
}

function budgetColorClass(pct: number | null): string {
  if (pct === null) return "";
  if (pct >= 0.9) return "text-destructive";
  if (pct >= 0.7) return "text-warning";
  return "";
}

function barColorClass(pct: number): string {
  if (pct >= 0.9) return "bg-destructive";
  if (pct >= 0.7) return "bg-warning";
  return "bg-accent/40";
}

export function ChatStatusline() {
  const { session, selectedModel, selectedMode, challengerModel } = useChatContext();
  const { messages, status, totalUsage } = session;

  if (messages.length === 0) return null;

  const modelLabel = selectedModel ? (selectedModel.split(":")[1] ?? selectedModel) : "Auto";
  const modeLabel = getAssistantModeLabel(selectedMode);
  const challengerLabel = challengerModel
    ? (challengerModel.split(":")[1] ?? challengerModel)
    : null;
  const isActive = status === "streaming" || status === "submitted";
  const totalTokens = totalUsage?.totalTokens ?? 0;
  const ctxInfo = getContextWindowInfo(selectedModel, totalTokens);
  const budgetColor = budgetColorClass(ctxInfo?.pct ?? null);

  return (
    <div className="shrink-0 border-border border-t bg-surface-raised">
      {/* Context window progress bar */}
      {ctxInfo && ctxInfo.pct > 0 && (
        <div className="h-px bg-border/20">
          <div
            className={cn("h-full transition-all duration-500", barColorClass(ctxInfo.pct))}
            style={{ width: `${ctxInfo.pct * 100}%` }}
          />
        </div>
      )}

      <div className="flex items-center justify-between gap-4 px-5 py-3 font-mono text-w-xs">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 font-bold text-accent uppercase tracking-widest">
            {modeLabel}
          </span>
          <span className="shrink-0 text-dim opacity-30">|</span>
          <span className="truncate font-bold text-foreground uppercase tracking-tighter">
            {modelLabel}
          </span>
          {Boolean(challengerLabel) && (
            <>
              <span className="shrink-0 text-dim opacity-30">vs</span>
              <span className="truncate font-bold text-foreground uppercase tracking-tighter">
                {challengerLabel}
              </span>
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-4">
          {totalUsage && totalUsage.totalTokens > 0 && (
            <span
              className={cn("font-bold uppercase tracking-tighter", budgetColor || "text-dim")}
              title={ctxInfo ? `${Math.round(ctxInfo.pct * 100)}% of context window` : undefined}
            >
              {totalUsage.totalTokens.toLocaleString()} TOKENS
              {ctxInfo && ctxInfo.pct >= 0.7 && (
                <span className="ml-1 opacity-60">({Math.round(ctxInfo.pct * 100)}%)</span>
              )}
            </span>
          )}

          {Boolean(isActive) && (
            <span className="flex animate-pulse items-center gap-2 font-bold text-accent uppercase tracking-widest">
              <span className="h-2 w-2 bg-current" />
              LIVE
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
