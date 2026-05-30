"use client";

import { Button } from "@radarboard/ui/button";
import { Loader2Icon, SlashIcon } from "lucide-react";
import type {
  ChatInsertCommandGroup,
  ChatInsertCommandItem,
  InsertCommandScope,
} from "./chat-insert-data";

export function ChatCommandMenu({
  groups,
  loading,
  scope,
  selectedIndex,
  onSelect,
}: {
  groups: ChatInsertCommandGroup[];
  loading: boolean;
  scope: InsertCommandScope;
  selectedIndex: number;
  onSelect: (item: ChatInsertCommandItem) => void;
}) {
  if (!loading && groups.length === 0) {
    return (
      <div className="mb-1 overflow-hidden rounded-item border border-[var(--color-border)] bg-[var(--color-surface)]">
        <p className="px-3 py-3 font-mono text-[var(--color-text-muted)] text-w-sm">
          No slash commands found.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-1 overflow-hidden rounded-item border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center gap-1 border-[var(--color-border)] border-b px-3 py-2 font-mono text-[var(--color-text-muted)] text-w-sm uppercase tracking-widest">
        <SlashIcon size={10} />
        {scope === "all" ? "Insert Context" : `/${scope.slice(0, -1)}`}
        {Boolean(loading) && <Loader2Icon size={10} className="ml-auto animate-spin" />}
      </div>

      <div className="scrollbar-thin max-h-64 overflow-y-auto">
        {groups.map((group, groupIndex) => {
          let runningIndex = groups
            .slice(0, groupIndex)
            .reduce((sum, current) => sum + current.items.length, 0);

          return (
            <div key={group.id} className="border-[var(--color-border)]/50 border-b last:border-0">
              {scope === "all" && (
                <div className="px-3 py-2 font-mono text-[var(--color-text-muted)] text-w-sm uppercase tracking-widest">
                  {group.label}
                </div>
              )}
              {group.items.map((item) => {
                const isSelected = runningIndex === selectedIndex;
                runningIndex += 1;

                return (
                  <Button
                    key={item.id}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      onSelect(item);
                    }}
                    variant="ghost"
                    uppercase={false}
                    fullWidth
                    className={[
                      "block h-auto px-3 py-2 text-left",
                      isSelected ? "bg-[var(--color-accent)]/10" : "hover:bg-[var(--color-hover)]",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-2">
                      <span className="truncate font-mono text-[var(--color-text)] text-w-sm">
                        {item.title}
                      </span>
                      <span className="shrink-0 rounded-item border border-[var(--color-border)] px-1 py-0.5 font-mono text-[var(--color-text-muted)] text-w-sm uppercase tracking-widest">
                        {item.action === "attach" ? "attach" : "insert"}
                      </span>
                      {scope === "all" && (
                        <span className="shrink-0 font-mono text-[var(--color-text-muted)] text-w-sm uppercase tracking-widest">
                          {item.tab}
                        </span>
                      )}
                      {Boolean(item.badge) && (
                        <span className="truncate rounded-item border border-[var(--color-border)] px-1 py-0.5 font-mono text-[var(--color-text-muted)] text-w-sm uppercase tracking-widest">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 font-mono text-[var(--color-text-muted)] text-w-sm">
                      {item.description}
                    </p>
                  </Button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
