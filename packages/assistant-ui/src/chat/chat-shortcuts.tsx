"use client";

import { Button } from "@radarboard/ui/button";
import { XIcon } from "lucide-react";
import { useEffect } from "react";

const SHORTCUTS = [
  { keys: ["Esc"], description: "Close chat" },
  { keys: ["⌘", "B"], description: "Toggle thread list" },
  { keys: ["⌘", "K"], description: "Focus composer" },
  { keys: ["⌘", "Shift", "F"], description: "Search messages" },
  { keys: ["⌘", "/"], description: "Show this cheatsheet" },
  { keys: ["↑"], description: "Edit last message (when composer is empty)" },
  { keys: ["Enter"], description: "Send message" },
  { keys: ["Shift", "Enter"], description: "New line in message" },
];

export function ChatShortcuts({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40">
      <Button
        type="button"
        variant="ghost"
        spacing="none"
        uppercase={false}
        className="absolute inset-0 h-full w-full rounded-none bg-transparent p-0 hover:bg-transparent"
        onClick={onClose}
        aria-label="Close keyboard shortcuts"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        className="relative w-72 rounded-card border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="font-bold font-mono text-[var(--color-text-muted)] text-w-sm uppercase tracking-widest">
            Keyboard shortcuts
          </span>
          <Button
            type="button"
            onClick={onClose}
            aria-label="Close"
            variant="ghost"
            size="icon-sm"
            uppercase={false}
            className="text-[var(--color-text-muted)]/50 hover:text-[var(--color-text-muted)]"
          >
            <XIcon size={12} />
          </Button>
        </div>
        <ul className="flex flex-col gap-2">
          {SHORTCUTS.map((s) => (
            <li key={s.description} className="flex items-center justify-between gap-4">
              <span className="font-mono text-[var(--color-text-muted)] text-w-sm">
                {s.description}
              </span>
              <div className="flex shrink-0 items-center gap-1">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="rounded-item border border-[var(--color-border)] bg-[var(--color-hover)] px-1.5 py-0.5 font-mono text-[var(--color-text-muted)] text-w-sm"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
