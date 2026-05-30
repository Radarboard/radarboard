"use client";

import type { Project } from "@radarboard/types/project";
import { Button } from "@radarboard/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@radarboard/ui/tooltip";
import { cn } from "@radarboard/utils/cn";
import type { CSSProperties } from "react";

const PROJECT_TABS_MASK_STYLE: CSSProperties = {
  maskImage: "linear-gradient(90deg, black 0%, black calc(100% - 24px), transparent 100%)",
  // biome-ignore lint/style/useNamingConvention: WebkitMaskImage is a vendor-prefixed CSS property
  WebkitMaskImage: "linear-gradient(90deg, black 0%, black calc(100% - 24px), transparent 100%)",
};

interface ProjectTabsProps {
  projects: Project[];
  activeSlug: string | null;
  pendingSlug?: string | null;
  isPending?: boolean;
  variant?: "default" | "header";
  onSelect: (slug: string | null) => void;
  onPrefetch?: (slug: string | null) => void;
}

interface TabButtonProps {
  label: string;
  slug: string | null;
  activeSlug: string | null;
  pendingSlug: string | null;
  isPending: boolean;
  variant: "default" | "header";
  color?: string;
  onSelect: (slug: string | null) => void;
  onPrefetch?: (slug: string | null) => void;
}

function getTabClassName(
  slug: string | null,
  isActive: boolean,
  isPendingTarget: boolean,
  isDimmed: boolean,
  variant: "default" | "header"
): string {
  return cn(
    "group relative cursor-pointer overflow-hidden border-r border-border py-1 font-mono text-w-sm uppercase tracking-wider whitespace-nowrap transition-interactive",
    variant === "header" ? "px-2" : "px-2.5",
    slug === null && isActive ? "bg-accent" : "",
    slug === null && isPendingTarget ? "bg-accent/30" : "",
    isActive || isPendingTarget ? "text-white" : "text-dim hover:text-foreground-secondary",
    isDimmed ? "opacity-55" : "opacity-100"
  );
}

function getTabStyle(
  color: string | undefined,
  isActive: boolean,
  isPendingTarget: boolean
): CSSProperties | undefined {
  if (isActive && color) {
    return { backgroundColor: color };
  }

  if (isPendingTarget && color) {
    return { backgroundColor: `${color}33` };
  }

  return undefined;
}

function getUnderlineClassName(isActive: boolean, isPendingTarget: boolean): string {
  return cn(
    "pointer-events-none absolute inset-x-2 bottom-0 h-px origin-left transition-interactive",
    isActive ? "scale-x-100 bg-white/70" : "",
    isPendingTarget ? "scale-x-100 bg-white/40" : "",
    !isActive && !isPendingTarget
      ? "scale-x-0 bg-white/0 group-hover:scale-x-100 group-hover:bg-white/20"
      : ""
  );
}

function getAccentRailClassName(
  isActive: boolean,
  isPendingTarget: boolean,
  hasAccentRail: boolean
): string {
  return cn(
    "pointer-events-none absolute inset-x-2 bottom-0 h-px origin-left transition-interactive",
    hasAccentRail ? "opacity-70" : "opacity-0",
    isActive || isPendingTarget ? "hidden" : ""
  );
}

function getAccentRailStyle(
  color: string | undefined,
  isActive: boolean,
  isPendingTarget: boolean,
  hasAccentRail: boolean
): CSSProperties | undefined {
  if (!hasAccentRail || !color || isActive || isPendingTarget) {
    return undefined;
  }

  return {
    backgroundImage: `linear-gradient(90deg, ${color}aa 0%, ${color}55 45%, transparent 100%)`,
  };
}

function getDotClassName(
  color: string | undefined,
  isActive: boolean,
  isPendingTarget: boolean
): string {
  return cn(
    "h-1.5 w-1.5 rounded-full shadow-glow transition-interactive",
    color || isActive || isPendingTarget ? "opacity-100" : "opacity-70",
    isActive ? "scale-110 shadow-glow" : "",
    isPendingTarget ? "motion-safe:animate-pulse" : ""
  );
}

function getDotStyle(
  color: string | undefined,
  isActive: boolean,
  isPendingTarget: boolean
): CSSProperties | undefined {
  return {
    backgroundColor: isActive || isPendingTarget ? "#ffffff" : (color ?? "#777777"),
  };
}

function getLabelClassName(variant: "default" | "header"): string {
  return cn(
    "inline-block truncate align-bottom",
    variant === "header" ? "max-w-28 md:max-w-32 xl:max-w-40" : "max-w-32 md:max-w-40"
  );
}

function TabButton({
  label,
  slug,
  activeSlug,
  pendingSlug,
  isPending,
  variant,
  color,
  onSelect,
  onPrefetch,
}: TabButtonProps) {
  const isActive = activeSlug === slug;
  const isPendingTarget = isPending && pendingSlug === slug && activeSlug !== slug;
  const hasAccentRail = Boolean(color);
  const showIndicator = slug !== null;
  const isDimmed = isPending && !isActive && !isPendingTarget;
  const tabTestId = slug ? `project-tab-${slug}` : "project-tab-all";
  const indicatorTestId = slug ? `project-tab-indicator-${slug}` : "project-tab-indicator-all";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          uppercase={false}
          rounded="none"
          data-testid={tabTestId}
          aria-busy={isPendingTarget || undefined}
          onClick={() => onSelect(slug)}
          onMouseEnter={() => onPrefetch?.(slug)}
          onFocus={() => onPrefetch?.(slug)}
          className={getTabClassName(slug, isActive, isPendingTarget, isDimmed, variant)}
          style={getTabStyle(color, isActive, isPendingTarget)}
        >
          <span className="relative inline-flex items-center gap-1.5">
            {showIndicator ? (
              <span className="inline-flex w-2.5 shrink-0 items-center justify-center">
                <span
                  aria-hidden="true"
                  data-testid={indicatorTestId}
                  className={getDotClassName(color, isActive, isPendingTarget)}
                  style={getDotStyle(color, isActive, isPendingTarget)}
                />
              </span>
            ) : null}
            {slug !== null ? <span className={getLabelClassName(variant)}>{label}</span> : label}
          </span>
          <span className={getUnderlineClassName(isActive, isPendingTarget)} />
          <span
            aria-hidden="true"
            className={getAccentRailClassName(isActive, isPendingTarget, hasAccentRail)}
            style={getAccentRailStyle(color, isActive, isPendingTarget, hasAccentRail)}
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

export function ProjectTabs({
  projects,
  activeSlug,
  pendingSlug = null,
  isPending = false,
  variant = "default",
  onSelect,
  onPrefetch,
}: ProjectTabsProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          "scrollbar-thin flex items-center gap-0 overflow-x-auto",
          variant === "header" ? "min-w-0 flex-1" : ""
        )}
        style={PROJECT_TABS_MASK_STYLE}
      >
        <TabButton
          label="All Projects"
          slug={null}
          activeSlug={activeSlug}
          pendingSlug={pendingSlug}
          isPending={isPending}
          variant={variant}
          onSelect={onSelect}
          onPrefetch={onPrefetch}
        />
        {projects.map((project) => (
          <TabButton
            key={project.slug}
            label={project.name}
            slug={project.slug}
            activeSlug={activeSlug}
            pendingSlug={pendingSlug}
            isPending={isPending}
            variant={variant}
            color={project.color}
            onSelect={onSelect}
            onPrefetch={onPrefetch}
          />
        ))}
      </div>
    </TooltipProvider>
  );
}
