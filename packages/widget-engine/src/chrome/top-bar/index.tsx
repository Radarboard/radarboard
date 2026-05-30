"use client";

import type { DisplayCurrency, TimeRange } from "@radarboard/types/dashboard";
import { Button } from "@radarboard/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@radarboard/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@radarboard/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@radarboard/ui/tooltip";
import { cn } from "@radarboard/utils/cn";
import {
  BotIcon,
  FlaskConical,
  LayoutTemplate,
  PenLine,
  PenOff,
  Plug,
  Search,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useRef, useState } from "react";

interface TopBarProps {
  projectTabsSlot?: ReactNode;
  timeRange: TimeRange;
  currency: DisplayCurrency;
  /** Active currencies from user preferences. Toggle hidden when ≤ 1. */
  currencies?: DisplayCurrency[];
  /** Hide the currency toggle entirely, even when multiple currencies are configured. */
  showCurrencyToggle?: boolean;
  onTimeRangeChange: (range: TimeRange) => void;
  onCurrencyChange: (currency: DisplayCurrency) => void;
  /** Open the global command palette. */
  onSearchOpen?: () => void;
  searchTooltip?: string;
  /** Whether layout edit mode is active. */
  isEditMode?: boolean;
  /** Toggle layout edit mode. */
  onEditModeToggle?: () => void;
  editTooltip?: string;
  /** Whether the AI chat drawer is open. */
  isChatOpen?: boolean;
  /** Toggle the AI chat drawer. */
  onChatToggle?: () => void;
  assistantTooltip?: string;
  /** Open the blueprint picker in edit mode. */
  onApplyBlueprint?: () => void;
  /** App-level actions injected into the right side of the top bar. */
  actionsSlot?: ReactNode;
  /** Whether the dashboard is in demo mode. */
  isDemoMode?: boolean;
  /** Callback to exit demo mode and start real setup (opens onboarding). */
  onExitDemo?: () => void;
  /** Callback to dismiss demo mode without onboarding. */
  onDismissDemo?: () => void;
}

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: "today", label: "TODAY" },
  { value: "7d", label: "7D" },
  { value: "15d", label: "15D" },
  { value: "30d", label: "30D" },
  { value: "3m", label: "90D" },
  { value: "1y", label: "1Y" },
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
const TOP_BAR_TIME_RANGE_TRIGGER_CLASSNAME =
  "h-7 w-20 shrink-0 border-border bg-surface px-3 font-mono text-foreground text-w-sm uppercase tracking-wider";

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

function getSearchActionProps(
  hasProjectTabsSlot: boolean
): Pick<TopBarActionButtonProps, "className" | "labelVisibility"> {
  return {
    className: hasProjectTabsSlot ? "justify-start" : "lg:min-w-28 lg:justify-start xl:min-w-32",
    labelVisibility: hasProjectTabsSlot ? "priority" : "always",
  };
}

interface TopBarActionButtonProps {
  icon: ReactNode;
  label: string;
  ariaLabel: string;
  className?: string;
  isActive?: boolean;
  labelVisibility?: TopBarActionLabelVisibility;
  onClick?: () => void;
  tooltip?: string;
}

export function TopBarActionButton({
  icon,
  label,
  ariaLabel,
  className,
  isActive = false,
  labelVisibility = "always",
  onClick,
  tooltip,
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
        isActive ? TOP_BAR_SELECTED_STATE_CLASSNAME : TOP_BAR_INACTIVE_STATE_CLASSNAME,
        className
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
  projectTabsSlot,
  timeRange,
  currency,
  currencies,
  showCurrencyToggle = true,
  onTimeRangeChange,
  onCurrencyChange,
  onSearchOpen,
  searchTooltip,
  isEditMode,
  onEditModeToggle,
  editTooltip,
  isChatOpen,
  onChatToggle,
  assistantTooltip,
  onApplyBlueprint,
  actionsSlot,
  isDemoMode,
  onExitDemo,
  onDismissDemo,
}: TopBarProps) {
  const hasProjectTabsSlot = Boolean(projectTabsSlot);
  const searchActionProps = getSearchActionProps(hasProjectTabsSlot);
  const hasTrailingActions = Boolean(
    onEditModeToggle ||
      (isEditMode && onApplyBlueprint) ||
      onChatToggle ||
      isDemoMode ||
      actionsSlot
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex min-w-0 items-center gap-3 overflow-hidden px-4 py-2">
        <div className="flex min-w-0 flex-1 items-center overflow-hidden">
          {projectTabsSlot ?? (
            <h1 className="shrink-0 font-bold font-mono text-foreground text-w-lg uppercase tracking-widest">
              Radarboard
            </h1>
          )}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-4">
          <div className="flex shrink-0 items-center gap-2">
            {Boolean(onSearchOpen) && (
              <TopBarActionButton
                onClick={onSearchOpen}
                icon={<Search className="icon-sm" />}
                label="Search"
                ariaLabel="Open command palette"
                {...searchActionProps}
                tooltip={searchTooltip}
              />
            )}
            <Select
              value={timeRange}
              onValueChange={(v) => {
                if (v) onTimeRangeChange(v as TimeRange);
              }}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <SelectTrigger
                    aria-label="Metric time range"
                    variant="surface"
                    rounded="none"
                    className={TOP_BAR_TIME_RANGE_TRIGGER_CLASSNAME}
                  >
                    <SelectValue />
                  </SelectTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Metric time range for date-sensitive widgets
                </TooltipContent>
              </Tooltip>
              <SelectContent align="end" className="rounded-none">
                {TIME_RANGES.map((range) => (
                  <SelectItem
                    className="rounded-none uppercase tracking-wider"
                    indicatorPosition="right"
                    key={range.value}
                    value={range.value}
                  >
                    {range.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {showCurrencyToggle && (!currencies || currencies.length > 1) && (
              <ToggleGroup
                className="shrink-0"
                type="single"
                value={currency}
                onValueChange={(v) => {
                  if (v) onCurrencyChange(v as DisplayCurrency);
                }}
              >
                {(currencies ?? CURRENCIES.map((c) => c.value)).map((val) => (
                  <ToggleGroupItem className={TOP_BAR_SEGMENT_ITEM_CLASSNAME} key={val} value={val}>
                    {val}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            )}
          </div>

          {hasTrailingActions ? (
            <div className="ml-2 flex shrink-0 items-center justify-end gap-1">
              {actionsSlot}
              {Boolean(onChatToggle) && (
                <TopBarActionButton
                  onClick={onChatToggle}
                  icon={<BotIcon className="icon-sm" />}
                  label="Assistant"
                  labelVisibility="wide"
                  isActive={Boolean(isChatOpen)}
                  ariaLabel={isChatOpen ? "Close AI assistant" : "Open AI assistant"}
                  tooltip={assistantTooltip}
                />
              )}
              {Boolean(onEditModeToggle) && (
                <TopBarActionButton
                  onClick={isDemoMode ? undefined : onEditModeToggle}
                  icon={
                    isEditMode ? <PenOff className="icon-sm" /> : <PenLine className="icon-sm" />
                  }
                  label="Edit"
                  labelVisibility="never"
                  isActive={Boolean(isEditMode) && !isDemoMode}
                  ariaLabel={
                    isDemoMode
                      ? "Edit disabled in demo"
                      : isEditMode
                        ? "Exit edit mode"
                        : "Edit layout"
                  }
                  tooltip={isDemoMode ? "Edit mode disabled in demo" : editTooltip}
                />
              )}
              {isEditMode && onApplyBlueprint ? (
                <TopBarActionButton
                  onClick={onApplyBlueprint}
                  icon={<LayoutTemplate className="icon-sm" />}
                  label="Blueprint"
                  labelVisibility="never"
                  ariaLabel="Apply blueprint"
                  tooltip="Apply blueprint"
                />
              ) : null}
              {isDemoMode ? (
                <DemoBadge onConnectServices={onExitDemo} onDismiss={onDismissDemo} />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </TooltipProvider>
  );
}

// ---------------------------------------------------------------------------
// Demo badge with popover
// ---------------------------------------------------------------------------

function DemoBadge({
  onConnectServices,
  onDismiss,
}: {
  onConnectServices?: () => void;
  onDismiss?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLFieldSetElement>(null);

  const handleBlur = useCallback((e: React.FocusEvent) => {
    if (ref.current && !ref.current.contains(e.relatedTarget)) {
      setOpen(false);
    }
  }, []);

  return (
    <fieldset
      ref={ref}
      className="relative m-0 min-w-0 border-0 p-0"
      onBlur={handleBlur}
      tabIndex={-1}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            uppercase={false}
            onClick={() => setOpen((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 rounded-item border border-warning/30 bg-warning/10 px-2.5 py-1",
              "font-mono text-w-sm text-warning uppercase tracking-widest",
              "transition-colors hover:bg-warning/20"
            )}
            aria-label="Demo mode active"
          >
            <FlaskConical className="icon-xs" />
            Demo
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">You're viewing sample data</TooltipContent>
      </Tooltip>

      {open ? (
        <div className="absolute top-full right-0 z-50 mt-2 w-64 rounded-item border border-border bg-surface p-4 shadow-lg">
          <p className="font-mono text-dim text-w-sm">
            You&apos;re viewing <strong className="text-foreground-secondary">sample data</strong>.
            Connect your services to see real metrics.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {onConnectServices ? (
              <Button
                type="button"
                variant="default"
                uppercase={false}
                onClick={() => {
                  setOpen(false);
                  onConnectServices();
                }}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-item bg-accent px-3 py-1.5",
                  "font-mono text-primary-foreground text-w-sm uppercase tracking-widest",
                  "transition-colors hover:bg-accent/90"
                )}
              >
                <Plug className="icon-xs" />
                Connect services
              </Button>
            ) : null}
            {onDismiss ? (
              <Button
                type="button"
                variant="ghost-link"
                spacing="none"
                uppercase={false}
                onClick={() => {
                  setOpen(false);
                  onDismiss();
                }}
                className="flex items-center justify-center gap-1.5 font-mono text-dim text-w-sm uppercase tracking-widest hover:text-foreground-secondary"
              >
                <X className="icon-xs" />
                Dismiss demo
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </fieldset>
  );
}
