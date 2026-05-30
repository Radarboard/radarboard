"use client";

import { API_ROUTES } from "@radarboard/types/api-routes";
import { EmptyState } from "@radarboard/ui/empty-state";
import { parseAsString, useQueryState } from "nuqs";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DebugCell,
  DebugRow,
  DebugSection,
  DebugTable,
  LoadingState,
  relativeTime,
  SectionHeader,
} from "../../shared";

interface ConversationRow {
  id: string;
  title: string;
  projectSlug: string | null;
  createdAt: string;
  updatedAt: string;
}

export function ConversationsSection() {
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConversationId] = useQueryState("conversationId", parseAsString);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(API_ROUTES.chatConversations);
    const data = (await res.json()) as ConversationRow[] | { conversations: ConversationRow[] };
    setConversations(Array.isArray(data) ? data : (data.conversations ?? []));
    setLoading(false);
  }, []);

  useEffect(() => {
    load().catch(() => {
      /* fire-and-forget */
    });
  }, [load]);

  const orderedConversations = useMemo(() => {
    if (!selectedConversationId) return conversations;
    const selected = conversations.find(
      (conversation) => conversation.id === selectedConversationId
    );
    const rest = conversations.filter((conversation) => conversation.id !== selectedConversationId);
    return selected ? [selected, ...rest] : conversations;
  }, [conversations, selectedConversationId]);

  return (
    <DebugSection>
      <SectionHeader label={`${conversations.length} conversations`} onRefresh={load} />

      {Boolean(loading) && <LoadingState />}
      {!loading && conversations.length === 0 && <EmptyState message="No conversations yet." />}
      {!loading && conversations.length > 0 && (
        <DebugTable headers={["Title", "Project", "Created", "Updated"]}>
          {orderedConversations.map((c) => (
            <DebugRow key={c.id}>
              <DebugCell className="max-w-[400px] truncate text-foreground-secondary">
                {c.title}
              </DebugCell>
              <DebugCell className="text-dim">{c.projectSlug ?? "—"}</DebugCell>
              <DebugCell className="text-dim/70">{relativeTime(c.createdAt)}</DebugCell>
              <DebugCell
                className={c.id === selectedConversationId ? "text-accent" : "text-dim/70"}
              >
                {relativeTime(c.updatedAt)}
              </DebugCell>
            </DebugRow>
          ))}
        </DebugTable>
      )}
    </DebugSection>
  );
}
