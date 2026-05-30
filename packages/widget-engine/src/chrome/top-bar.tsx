"use client";

import type { DisplayCurrency, TimeRange } from "@radarboard/types/dashboard";
import { Button } from "@radarboard/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@radarboard/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@radarboard/ui/tooltip";
import { cn } from "@radarboard/utils/cn";
import { BotIcon, BrainCircuit, BugIcon, PenLine, PenOff } from "lucide-react";
import type { ReactNode } from "react";

interface TopBarProps {
  timeRange: TimeRange;
  currency: DisplayCurrency;
  /** Hide the currency toggle entirely, even when multiple currencies are configured. */
  showCurrencyToggle?: boolean;
  onTimeRangeChange: (range: TimeRange) => void;
  onCurrencyChange: (currency: DisplayCurrency) => void;
  /** Navigate to the Knowledge Health page. */
  onKnowledgeClick?: () => void;
  /** Navigate to the debug page. */
  onDebugClick?: () => void;
  /** Whether layout edit mode is active. */
  isEditMode?: boolean;
  /** Toggle layout edit mode. */
  onEditModeToggle?: () => void;
  /** Whether the AI chat drawer is open. */
  isChatOpen?: boolean;
  /** Toggle the AI chat drawer. */
  onChatToggle?: () => void;
  /** App-level actions injected into the right side of the top bar. */
  actionsSlot?: ReactNode;
}

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: "today", label: "TODAY" },
  { value: "7d", label: "7d" },
  { value: "15d", label: "15d" },
  { value: "30d", label: "30d" },
  { value: "3m", label: "90D" },
  { value: "1y", label: "1y" },
];

const CURRENCIES: { value: DisplayCurrency; label: string }[] = [
  { value: "USD", label: "USD" },
  { value: "CAD", label: "CAD" },
];

type TopBarActionLabelVisibility = "always" | "priority" | "wide" | "never";

const TOP_BAR_INACTIVE_STATE_CLASSNAME =
  "text-dim hover:dark:bg-muted/50 hover:dark:text-foreground-secondary transition-interactive";
const TOP_BAR_SELECTED_STATE_CLASSNAME =
  "dark:bg-surface-raised dark:text-foreground shadow-glow transition-interactive";
const TOP_BAR_SEGMENT_ITEM_CLASSNAME = cn(
  TOP_BAR_INACTIVE_STATE_CLASSNAME,
  "data-[state=on]:dark:bg-surface-raised data-[state=on]:dark:text-foreground data-[state=on]:shadow-glow data-[state=on]:hover:dark:bg-surface-raised data-[state=on]:hover:dark:text-foreground"
);

const TOP_BAR_ACTION_BUTTON_CLASSNAME =
  "inline-flex h-7 shrink-0 items-center gap-2 border border-border dark:bg-surface px-2.5 text-w-sm font-mono uppercase tracking-wider whitespace-nowrap transition-interactive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50";

export function getTopBarActionLabelClassName(visibility: TopBarActionLabelVisibility): string {
  switch (visibility) {
    case "priority":
      return "hidden lg:inline";
    case "wide":
      return "hidden xl:inline";
    case "never":
      return "hidden";
    default:
      return "inline";
  }
}

interface TopBarActionButtonProps {
  icon: ReactNode;
  label: string;
  ariaLabel: string;
  tooltip?: string;
  isActive?: boolean;
  labelVisibility?: TopBarActionLabelVisibility;
  onClick?: () => void;
}

export function TopBarActionButton({
  icon,
  label,
  ariaLabel,
  tooltip,
  isActive = false,
  labelVisibility = "always",
  onClick,
}: TopBarActionButtonProps) {
  const button = (
    <Button
      type="button"
      variant="ghost"
      uppercase={false}
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        TOP_BAR_ACTION_BUTTON_CLASSNAME,
        isActive ? TOP_BAR_SELECTED_STATE_CLASSNAME : TOP_BAR_INACTIVE_STATE_CLASSNAME
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className={getTopBarActionLabelClassName(labelVisibility)}>{label}</span>
    </Button>
  );

  if (!tooltip) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="bottom">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export function TopBar({
  timeRange,
  currency,
  showCurrencyToggle = true,
  onTimeRangeChange,
  onCurrencyChange,
  onKnowledgeClick,
  onDebugClick,
  isEditMode,
  onEditModeToggle,
  isChatOpen,
  onChatToggle,
  actionsSlot,
}: TopBarProps) {
  const hasTrailingActions = Boolean(
    onEditModeToggle || onChatToggle || onKnowledgeClick || onDebugClick || actionsSlot
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2">
        <h1 className="shrink-0 font-bold font-mono text-foreground text-w-md uppercase tracking-widest">
          Radarboard
        </h1>

        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <ToggleGroup
                className="shrink-0"
                type="single"
                value={timeRange}
                aria-label="Metric time range"
                onValueChange={(v) => {
                  if (v) onTimeRangeChange(v as TimeRange);
                }}
              >
                {TIME_RANGES.map((r) => (
                  <ToggleGroupItem
                    className={TOP_BAR_SEGMENT_ITEM_CLASSNAME}
                    key={r.value}
                    value={r.value}
                  >
                    {r.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Metric time range for date-sensitive widgets
            </TooltipContent>
          </Tooltip>

          {showCurrencyToggle ? (
            <ToggleGroup
              className="shrink-0"
              type="single"
              value={currency}
              onValueChange={(v) => {
                if (v) onCurrencyChange(v as DisplayCurrency);
              }}
            >
              {CURRENCIES.map((c) => (
                <ToggleGroupItem
                  className={TOP_BAR_SEGMENT_ITEM_CLASSNAME}
                  key={c.value}
                  value={c.value}
                >
                  {c.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          ) : null}

          {hasTrailingActions ? (
            <div className="ml-2 flex min-w-0 flex-wrap items-center justify-end gap-1">
              {Boolean(onEditModeToggle) && (
                <TopBarActionButton
                  onClick={onEditModeToggle}
                  icon={
                    isEditMode ? <PenOff className="icon-sm" /> : <PenLine className="icon-sm" />
                  }
                  label="Edit"
                  labelVisibility="never"
                  isActive={Boolean(isEditMode)}
                  ariaLabel={isEditMode ? "Exit edit mode" : "Edit layout"}
                  tooltip={
                    isEditMode ? "Exit edit mode" : "Edit layout — drag widgets and resize panels"
                  }
                />
              )}
              {Boolean(onChatToggle) && (
                <TopBarActionButton
                  onClick={onChatToggle}
                  icon={<BotIcon className="icon-sm" />}
                  label="Assistant"
                  labelVisibility="wide"
                  isActive={Boolean(isChatOpen)}
                  ariaLabel={isChatOpen ? "Close AI assistant" : "Open AI assistant"}
                  tooltip="AI assistant"
                />
              )}
              {Boolean(onKnowledgeClick) && (
                <TopBarActionButton
                  onClick={onKnowledgeClick}
                  icon={<BrainCircuit className="icon-sm" />}
                  label="Knowledge"
                  labelVisibility="never"
                  ariaLabel="Open Knowledge Health"
                  tooltip="Knowledge Health — project inventory, effectiveness, and gaps"
                />
              )}
              {Boolean(onDebugClick) && (
                <TopBarActionButton
                  onClick={onDebugClick}
                  icon={<BugIcon className="icon-sm" />}
                  label="Debug"
                  labelVisibility="never"
                  ariaLabel="Debug"
                  tooltip="Debug — traces, memory, conversations"
                />
              )}
              {actionsSlot}
            </div>
          ) : null}
        </div>
      </div>
    </TooltipProvider>
  );
}
