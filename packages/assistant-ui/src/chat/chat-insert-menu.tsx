"use client";

import { Button } from "@radarboard/ui/button";
import { BookOpenIcon, FileTextIcon, FolderIcon, Loader2Icon, SparklesIcon } from "lucide-react";
import { useState } from "react";
import {
  buildInsertCommandItems,
  type ChatInsertDataState,
  type InsertTab,
} from "./chat-insert-data";

export function ChatInsertMenu({
  activeProject,
  data,
  onSelect,
}: {
  activeProject: string | null;
  data: ChatInsertDataState;
  onSelect: (item: ReturnType<typeof buildInsertCommandItems>[number]) => void;
}) {
  const [activeTab, setActiveTab] = useState<InsertTab>("projects");
  const items = buildInsertCommandItems(activeProject, data);
  const filteredItems = items.filter((item) => item.tab === activeTab);

  return (
    <div className="mb-1.5 overflow-hidden rounded-item border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center gap-1 border-[var(--color-border)] border-b px-2 py-1.5">
        {(
          [
            { id: "projects" as const, label: "Projects", icon: FolderIcon },
            { id: "notes" as const, label: "Notes", icon: BookOpenIcon },
            { id: "artifacts" as const, label: "Artifacts", icon: FileTextIcon },
          ] satisfies Array<{ id: InsertTab; label: string; icon: typeof FolderIcon }>
        ).map((tab) => (
          <Button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            variant="ghost"
            size="sm"
            uppercase
            className={
              activeTab === tab.id
                ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }
          >
            <tab.icon size={11} />
            {tab.label}
          </Button>
        ))}
        {Boolean(data.loading) && (
          <Loader2Icon size={11} className="ml-auto animate-spin text-[var(--color-text-muted)]" />
        )}
      </div>

      <div className="scrollbar-thin max-h-56 overflow-y-auto">
        {!data.loading && filteredItems.length === 0 && (
          <p className="px-3 py-3 font-mono text-[var(--color-text-muted)] text-w-sm">
            No saved {activeTab} yet.
          </p>
        )}

        {filteredItems.map((item) => (
          <Button
            key={item.id}
            type="button"
            onClick={() => onSelect(item)}
            variant="ghost"
            uppercase={false}
            fullWidth
            className="block h-auto rounded-none border-[var(--color-border)]/50 border-b px-3 py-2 text-left last:border-0 hover:bg-[var(--color-hover)]"
          >
            <div className="flex items-center gap-2">
              <span className="truncate font-mono text-[var(--color-text)] text-w-sm">
                {item.title}
              </span>
              <span className="shrink-0 rounded-item border border-[var(--color-border)] px-1 py-0.5 font-mono text-[var(--color-text-muted)] text-w-sm uppercase tracking-widest">
                {item.action === "attach" ? "attach" : "insert"}
              </span>
              {Boolean(item.badge) && (
                <span className="truncate rounded-item bg-[var(--color-accent)]/10 px-1.5 py-0.5 font-mono text-[var(--color-accent)] text-w-sm uppercase tracking-widest">
                  {item.badge}
                </span>
              )}
            </div>
            <p className="mt-1 line-clamp-2 font-mono text-[var(--color-text-muted)] text-w-sm">
              {item.description}
            </p>
          </Button>
        ))}

        {!data.loading && filteredItems.length > 0 && (
          <div className="flex items-center gap-1 px-3 py-2 font-mono text-[var(--color-text-muted)] text-w-sm">
            <SparklesIcon size={10} />
            Projects insert into the draft. Notes and artifacts attach as live context.
          </div>
        )}
      </div>
    </div>
  );
}
