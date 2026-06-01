"use client";

import { API_ROUTES, buildApiRoute } from "@radarboard/types/api-routes";
import type { LlmMessageSearchResult } from "@radarboard/types/database";
import { Button } from "@radarboard/ui/button";
import { Input } from "@radarboard/ui/input";
import { SearchIcon, XIcon } from "lucide-react";
import { useDeferredValue, useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { useChatContext } from "./chat-context";

async function fetchSearchResults(url: string): Promise<LlmMessageSearchResult[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to search messages: ${response.status}`);
  }
  return (await response.json()) as LlmMessageSearchResult[];
}

export function ChatSearch({ onClose }: { onClose: () => void }) {
  const { selectThread } = useChatContext();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const trimmedQuery = query.trim();
  const deferredQuery = useDeferredValue(trimmedQuery);
  const searchQuery = deferredQuery.length >= 2 ? deferredQuery : "";
  const { data: results = [], isLoading: loading } = useSWR<LlmMessageSearchResult[]>(
    searchQuery ? buildApiRoute(API_ROUTES.chatConversationSearch, { q: searchQuery }) : null,
    fetchSearchResults,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSelect = (result: LlmMessageSearchResult) => {
    selectThread(result.conversationId);
    onClose();
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-[var(--color-surface)]">
      {/* Search input */}
      <div className="flex items-center gap-2 border-[var(--color-border)] border-b px-3 py-2">
        <SearchIcon size={13} className="shrink-0 text-[var(--color-text-muted)]" />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search messages…"
          variant="ghost"
          size="default"
          className="flex-1 font-mono text-[var(--color-text)] text-w-base placeholder:text-[var(--color-text-muted)] placeholder:opacity-40"
        />
        {Boolean(loading) && (
          <span className="font-mono text-[var(--color-text-muted)] text-w-sm">searching…</span>
        )}
        <Button
          type="button"
          onClick={onClose}
          variant="ghost"
          size="icon-sm"
          uppercase={false}
          aria-label="Close search"
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text-muted)]"
        >
          <XIcon size={13} />
        </Button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {results.length === 0 && trimmedQuery.length >= 2 && !loading && (
          <p className="px-4 py-6 text-center font-mono text-[var(--color-text-muted)] text-w-sm">
            No results found
          </p>
        )}
        {results.length === 0 && trimmedQuery.length < 2 && (
          <p className="px-4 py-6 text-center font-mono text-[var(--color-text-muted)] text-w-sm">
            Type at least 2 characters to search
          </p>
        )}
        {results.map((r) => (
          <Button
            key={r.messageId}
            type="button"
            onClick={() => handleSelect(r)}
            variant="ghost"
            uppercase={false}
            fullWidth
            className="h-auto rounded-none border-[var(--color-border)]/50 border-b px-4 py-3 text-left hover:bg-[var(--color-hover)]"
          >
            <p className="mb-0.5 font-mono text-[var(--color-text-muted)] text-w-sm">
              {r.conversationTitle} · {r.role}
            </p>
            <p className="line-clamp-2 font-mono text-[var(--color-text)] text-w-base leading-relaxed">
              {r.snippet}
            </p>
          </Button>
        ))}
      </div>
    </div>
  );
}
