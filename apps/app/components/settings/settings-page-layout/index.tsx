"use client";

import { useDemoMode } from "@radarboard/hooks/use-demo-mode";
import { BalancedText } from "@radarboard/ui/balanced-text";
import { DemoGuard } from "@radarboard/ui/demo-guard";
import { Input } from "@radarboard/ui/input";
import { cn } from "@radarboard/utils/cn";
import { Search } from "lucide-react";
import type { ReactNode } from "react";

interface SettingsPageLayoutProps {
  /** Mono uppercase title (e.g. "Plugins", "Integrations"). */
  title: string;
  /** Short description below the title. */
  description: string;
  /** Status counter (e.g. "7/7 plugins enabled"). */
  statusText?: string;
  /** Color state for the status counter number. */
  statusColor?: "green" | "yellow" | "muted";
  /** Whether to show the search bar. Default: true. */
  showSearch?: boolean;
  /** Search placeholder text. */
  searchPlaceholder?: string;
  /** Controlled search query. */
  searchQuery?: string;
  /** Search query change handler. */
  onSearchChange?: (query: string) => void;
  /** Optional controls shown between the header and the search field. */
  headerSlot?: ReactNode;
  /** Page content — rendered below header + search. */
  children: ReactNode;
}

type SettingsGridColumns = 3 | 4 | 5;

const STATUS_COLORS = {
  green: "text-success",
  yellow: "text-warning",
  muted: "text-dim",
} as const;

export function SettingsPageLayout({
  title,
  description,
  statusText,
  statusColor = "muted",
  showSearch = true,
  searchPlaceholder = "Search...",
  searchQuery = "",
  onSearchChange,
  headerSlot,
  children,
}: SettingsPageLayoutProps) {
  const { isDemoMode } = useDemoMode();
  return (
    <DemoGuard isDemoMode={isDemoMode}>
      <div className="settings-page-layout scrollbar-thin h-full space-y-5 overflow-y-auto overflow-x-hidden p-5">
        {/* Header */}
        <div>
          <div className="mb-1 font-mono text-dim text-w-sm uppercase tracking-widest">{title}</div>
          <BalancedText as="div" className="mb-1 text-muted-foreground text-w-sm">
            {description}
          </BalancedText>
          {Boolean(statusText) && (
            <div className={cn("font-mono text-w-sm", STATUS_COLORS[statusColor])}>
              {statusText}
            </div>
          )}
        </div>

        {headerSlot}

        {/* Search */}
        {Boolean(showSearch) && onSearchChange && (
          <div className="relative">
            <Search className="icon-xs absolute top-1/2 left-3 -translate-y-1/2 text-dim" />
            <Input
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-9 w-full pl-9"
            />
          </div>
        )}

        {/* Content */}
        {children}
      </div>
    </DemoGuard>
  );
}

/**
 * Standard card grid for settings pages.
 * Use explicit column densities so settings views stay visually consistent.
 */
export function SettingsGrid({
  children,
  columns = 3,
  className,
}: {
  children: ReactNode;
  columns?: SettingsGridColumns;
  className?: string;
}) {
  return (
    <div data-columns={columns} className={cn("settings-card-grid", className)}>
      {children}
    </div>
  );
}

export function SettingsCardSection({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-foreground-secondary text-w-sm uppercase tracking-widest">
          {title}
        </span>
        {badge}
      </div>
      {children}
    </section>
  );
}

export function SettingsPanel({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn("space-y-3 rounded-panel border border-border bg-surface p-4", className)}
    >
      <div>
        <div className="font-mono text-dim text-w-sm uppercase tracking-widest">{title}</div>
        {description ? (
          <BalancedText as="div" className="mt-1 text-muted-foreground text-w-sm leading-relaxed">
            {description}
          </BalancedText>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function SettingsPageToolbar({
  navigation,
  actions,
  className,
}: {
  navigation?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  if (!navigation && !actions) return null;

  return (
    <div
      className={cn("flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between", className)}
    >
      {navigation != null ? <div className="min-w-0">{navigation}</div> : <div />}
      {actions != null ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function SettingsStatCard({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption: string;
}) {
  return (
    <div className="min-w-0 space-y-2 rounded-item border border-border bg-surface p-4">
      <div className="font-mono text-dim text-w-sm uppercase tracking-widest">{label}</div>
      <div className="font-mono text-foreground text-w-xl">{value}</div>
      <BalancedText as="div" className="text-muted-foreground text-w-sm leading-relaxed">
        {caption}
      </BalancedText>
    </div>
  );
}
