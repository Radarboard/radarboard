"use client";

import { Button } from "@radarboard/ui/button";
import { cn } from "@radarboard/utils/cn";

export interface SettingsSectionNavItem {
  id: string;
  label: string;
  description?: string;
  badge?: string;
}

interface SettingsSectionNavProps {
  items: ReadonlyArray<SettingsSectionNavItem>;
  activeId: string | null;
  onChange: (id: string | null) => void;
  orientation?: "horizontal" | "vertical";
  includeAll?: boolean;
  allLabel?: string;
  className?: string;
}

export function SettingsSectionNav({
  items,
  activeId,
  onChange,
  orientation = "horizontal",
  includeAll = false,
  allLabel = "All",
  className,
}: SettingsSectionNavProps) {
  const navItems: SettingsSectionNavItem[] = includeAll
    ? [{ id: "__all__", label: allLabel }, ...items]
    : [...items];

  if (orientation === "vertical") {
    return (
      <nav
        aria-label="Settings subsections"
        className={cn(
          "w-full shrink-0 space-y-1 border border-border bg-surface p-2 lg:w-56",
          className
        )}
      >
        {navItems.map((item) => {
          const isActive =
            item.id === "__all__" ? activeId === null : activeId !== null && activeId === item.id;

          return (
            <Button
              key={item.id}
              type="button"
              variant="ghost"
              onClick={() => onChange(item.id === "__all__" ? null : item.id)}
              className={cn(
                "uppercase-none h-auto w-full items-start justify-start rounded-none border-l-2 px-3 py-2 text-left",
                isActive
                  ? "border-accent bg-accent/10 text-foreground"
                  : "border-transparent text-dim hover:bg-muted hover:text-foreground-secondary"
              )}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-mono text-w-sm uppercase tracking-widest">
                    {item.label}
                  </span>
                  {item.badge ? (
                    <span className="rounded-item border border-border bg-card px-1.5 py-0.5 font-mono text-muted-foreground text-w-xs">
                      {item.badge}
                    </span>
                  ) : null}
                </div>
                {item.description ? (
                  <div className="mt-1 text-current/70 text-w-sm">{item.description}</div>
                ) : null}
              </div>
            </Button>
          );
        })}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Settings filters"
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      {navItems.map((item) => {
        const isActive =
          item.id === "__all__" ? activeId === null : activeId !== null && activeId === item.id;

        return (
          <Button
            key={item.id}
            type="button"
            variant={isActive ? "secondary" : "outline"}
            uppercase={false}
            onClick={() => onChange(item.id === "__all__" ? null : item.id)}
            className={cn(
              "h-auto rounded-none px-3 py-2 font-mono text-w-sm uppercase tracking-wider",
              !isActive && "text-dim hover:text-foreground-secondary"
            )}
          >
            {item.label}
          </Button>
        );
      })}
    </nav>
  );
}
