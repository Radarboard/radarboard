import type {
  AssistantArtifactContentType,
  AssistantArtifactQuery,
  AssistantArtifactRow,
  EmbeddingRow,
  LlmConversationRow,
  LlmMemoryRow,
  LlmMessageRow,
  LlmMessageSearchResult,
  LlmRepository,
  LlmSkillRow,
  LlmTraceRow,
  SupabaseConfig,
} from "@radarboard/types/database";

export class SupabaseLlmRepository implements LlmRepository {
  private url: string;
  private headers: Record<string, string>;

  constructor(config: SupabaseConfig) {
    this.url = `${config.url}/rest/v1`;
    this.headers = {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
      "Content-Type": "application/json",
    };
  }

  // --- Conversations ---

  async listConversations(): Promise<LlmConversationRow[]> {
    const res = await fetch(
      `${this.url}/llm_conversations?select=id,title,project_slug,created_at,updated_at&order=updated_at.desc`,
      { headers: this.headers }
    );
    if (!res.ok) return [];
    const rows = (await res.json()) as Array<Record<string, unknown>>;
    return rows.map(rowToConversation);
  }

  async createConversation(id: string, title: string, projectSlug: string | null): Promise<void> {
    const now = new Date().toISOString();
    await fetch(`${this.url}/llm_conversations`, {
      method: "POST",
      headers: { ...this.headers, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        id,
        title,
        project_slug: projectSlug,
        created_at: now,
        updated_at: now,
      }),
    });
  }

  async updateConversationTitle(id: string, title: string): Promise<void> {
    const now = new Date().toISOString();
    await fetch(`${this.url}/llm_conversations?id=eq.${id}`, {
      method: "PATCH",
      headers: { ...this.headers, Prefer: "return=minimal" },
      body: JSON.stringify({ title, updated_at: now }),
    });
  }

  async deleteConversation(id: string): Promise<void> {
    await fetch(`${this.url}/llm_messages?conversation_id=eq.${id}`, {
      method: "DELETE",
      headers: this.headers,
    });
    await fetch(`${this.url}/llm_conversations?id=eq.${id}`, {
      method: "DELETE",
      headers: this.headers,
    });
  }

  // --- Messages ---

  async getMessages(conversationId: string): Promise<LlmMessageRow[]> {
    const res = await fetch(
      `${this.url}/llm_messages?conversation_id=eq.${conversationId}&select=id,conversation_id,role,parts,created_at&order=created_at.asc`,
      { headers: this.headers }
    );
    if (!res.ok) return [];
    const rows = (await res.json()) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: r.id as string,
      conversationId: r.conversation_id as string,
      role: r.role as string,
      parts: r.parts as string,
      createdAt: r.created_at as string,
    }));
  }

  async appendMessage(msg: LlmMessageRow): Promise<void> {
    await fetch(`${this.url}/llm_messages`, {
      method: "POST",
      headers: { ...this.headers, Prefer: "return=minimal" },
      body: JSON.stringify({
        id: msg.id,
        conversation_id: msg.conversationId,
        role: msg.role,
        parts: msg.parts,
        created_at: msg.createdAt,
      }),
    });
  }

  // --- Memory ---

  async listMemory(projectSlug?: string): Promise<LlmMemoryRow[]> {
    const filter = projectSlug ? `&project_slug=eq.${projectSlug}` : "";
    const res = await fetch(
      `${this.url}/llm_memory?select=id,key,value,embedding,project_slug,created_at,updated_at&order=updated_at.desc${filter}`,
      { headers: this.headers }
    );
    if (!res.ok) return [];
    const rows = (await res.json()) as Array<Record<string, unknown>>;
    return rows.map(rowToMemory);
  }

  async upsertMemory(entry: LlmMemoryRow): Promise<void> {
    await fetch(`${this.url}/llm_memory`, {
      method: "POST",
      headers: { ...this.headers, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        id: entry.id,
        key: entry.key,
        value: entry.value,
        embedding: entry.embedding,
        project_slug: entry.projectSlug,
        created_at: entry.createdAt,
        updated_at: entry.updatedAt,
      }),
    });
  }

  async deleteMemory(id: string): Promise<void> {
    await fetch(`${this.url}/llm_memory?id=eq.${id}`, {
      method: "DELETE",
      headers: this.headers,
    });
  }

  // --- Custom Skills ---

  async listSkills(): Promise<LlmSkillRow[]> {
    const res = await fetch(
      `${this.url}/llm_skills?select=id,name,description,instructions,enabled,created_at,updated_at&order=name.asc`,
      { headers: this.headers }
    );
    if (!res.ok) return [];
    const rows = (await res.json()) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      description: r.description as string,
      instructions: r.instructions as string,
      enabled: Boolean(r.enabled),
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
    }));
  }

  async upsertSkill(skill: LlmSkillRow): Promise<void> {
    await fetch(`${this.url}/llm_skills`, {
      method: "POST",
      headers: { ...this.headers, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        id: skill.id,
        name: skill.name,
        description: skill.description,
        instructions: skill.instructions,
        enabled: skill.enabled,
        created_at: skill.createdAt,
        updated_at: skill.updatedAt,
      }),
    });
  }

  async deleteSkill(id: string): Promise<void> {
    await fetch(`${this.url}/llm_skills?id=eq.${id}`, {
      method: "DELETE",
      headers: this.headers,
    });
  }

  // --- Traces ---

  async insertTrace(trace: LlmTraceRow): Promise<void> {
    await fetch(`${this.url}/llm_traces`, {
      method: "POST",
      headers: { ...this.headers, Prefer: "return=minimal" },
      body: JSON.stringify({
        id: trace.id,
        conversation_id: trace.conversationId,
        provider_id: trace.providerId,
        model_id: trace.modelId,
        prompt_tokens: trace.promptTokens,
        completion_tokens: trace.completionTokens,
        total_tokens: trace.totalTokens,
        duration_ms: trace.durationMs,
        rating: trace.rating,
        created_at: trace.createdAt,
      }),
    });
  }
  async listTraces(limit = 100): Promise<LlmTraceRow[]> {
    const res = await fetch(
      `${this.url}/llm_traces?select=id,conversation_id,provider_id,model_id,prompt_tokens,completion_tokens,total_tokens,duration_ms,rating,created_at&order=created_at.desc&limit=${limit}`,
      { headers: this.headers }
    );
    if (!res.ok) return [];
    const rows = (await res.json()) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: r.id as string,
      conversationId: (r.conversation_id as string | null) ?? null,
      providerId: r.provider_id as string,
      modelId: r.model_id as string,
      promptTokens: Number(r.prompt_tokens ?? 0),
      completionTokens: Number(r.completion_tokens ?? 0),
      totalTokens: Number(r.total_tokens ?? 0),
      durationMs: Number(r.duration_ms ?? 0),
      rating: (r.rating as number | null) ?? null,
      createdAt: r.created_at as string,
    }));
  }
  async updateTraceRating(id: string, rating: number | null): Promise<void> {
    await fetch(`${this.url}/llm_traces?id=eq.${id}`, {
      method: "PATCH",
      headers: { ...this.headers, Prefer: "return=minimal" },
      body: JSON.stringify({ rating }),
    });
  }

  // --- Assistant workflow artifacts ---

  async listArtifacts(query: AssistantArtifactQuery = {}): Promise<AssistantArtifactRow[]> {
    const params = new URLSearchParams({
      select:
        "id,project_slug,mode,title,summary,body,content_type,status,source_conversation_id,created_at,next_mode,next_reason,evidence_refs",
      order: "created_at.desc",
      limit: String(query.limit && query.limit > 0 ? query.limit : 20),
    });
    if (query.projectSlug) params.set("project_slug", `eq.${query.projectSlug}`);
    if (query.mode) params.set("mode", `eq.${query.mode}`);
    if (query.sourceConversationId) {
      params.set("source_conversation_id", `eq.${query.sourceConversationId}`);
    }

    const res = await fetch(`${this.url}/llm_artifacts?${params.toString()}`, {
      headers: this.headers,
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as Array<Record<string, unknown>>;
    return rows.map(rowToArtifact);
  }

  async getArtifact(id: string): Promise<AssistantArtifactRow | null> {
    const res = await fetch(
      `${this.url}/llm_artifacts?id=eq.${id}&select=id,project_slug,mode,title,summary,body,content_type,status,source_conversation_id,created_at,next_mode,next_reason,evidence_refs&limit=1`,
      { headers: this.headers }
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<Record<string, unknown>>;
    return rows[0] ? rowToArtifact(rows[0]) : null;
  }

  async upsertArtifact(artifact: AssistantArtifactRow): Promise<void> {
    await fetch(`${this.url}/llm_artifacts`, {
      method: "POST",
      headers: { ...this.headers, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        id: artifact.id,
        project_slug: artifact.projectSlug,
        mode: artifact.mode,
        title: artifact.title,
        summary: artifact.summary,
        body: artifact.body,
        content_type: artifact.contentType,
        status: artifact.status,
        source_conversation_id: artifact.sourceConversationId,
        created_at: artifact.createdAt,
        next_mode: artifact.nextMode,
        next_reason: artifact.nextReason,
        evidence_refs: JSON.stringify(artifact.evidenceRefs),
      }),
    });
  }

  async searchMessages(query: string, limit = 20): Promise<LlmMessageSearchResult[]> {
    // Supabase REST: full-text search on parts column via ilike
    const encoded = encodeURIComponent(`*${query}*`);
    const msgRes = await fetch(
      `${this.url}/llm_messages?parts=ilike.${encoded}&select=id,conversation_id,role,parts&limit=${limit}&order=created_at.desc`,
      { headers: this.headers }
    );
    if (!msgRes.ok) return [];
    const msgs = (await msgRes.json()) as Array<{
      id: string;
      conversation_id: string;
      role: string;
      parts: string;
    }>;
    if (msgs.length === 0) return [];

    const convIds = [...new Set(msgs.map((m) => m.conversation_id))];
    const convRes = await fetch(
      `${this.url}/llm_conversations?id=in.(${convIds.join(",")})&select=id,title`,
      { headers: this.headers }
    );
    const convMap: Record<string, string> = {};
    if (convRes.ok) {
      const convs = (await convRes.json()) as Array<{ id: string; title: string }>;
      for (const c of convs) convMap[c.id] = c.title;
    }

    return msgs.map((m) => ({
      conversationId: m.conversation_id,
      conversationTitle: convMap[m.conversation_id] ?? "Unknown",
      messageId: m.id,
      role: m.role,
      snippet: supabaseSnippet(m.parts, query),
    }));
  }

  // --- Embeddings ---

  async listEmbeddings(source?: string, projectSlug?: string): Promise<EmbeddingRow[]> {
    let filter = "";
    if (source) filter += `&source=eq.${source}`;
    if (projectSlug) filter += `&project_slug=eq.${projectSlug}`;
    const res = await fetch(
      `${this.url}/embeddings?select=id,source,source_id,text,embedding,model_id,dimensions,project_slug,metadata,created_at,updated_at&order=updated_at.desc${filter}`,
      { headers: this.headers }
    );
    if (!res.ok) return [];
    const rows = (await res.json()) as Array<Record<string, unknown>>;
    return rows.map(rowToEmbedding);
  }

  async upsertEmbedding(row: EmbeddingRow): Promise<void> {
    await fetch(`${this.url}/embeddings`, {
      method: "POST",
      headers: { ...this.headers, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        id: row.id,
        source: row.source,
        source_id: row.sourceId,
        text: row.text,
        embedding: row.embedding,
        model_id: row.modelId,
        dimensions: row.dimensions,
        project_slug: row.projectSlug,
        metadata: row.metadata,
        created_at: row.createdAt,
        updated_at: row.updatedAt,
      }),
    });
  }

  async upsertEmbeddings(rows: EmbeddingRow[]): Promise<void> {
    for (const row of rows) {
      await this.upsertEmbedding(row);
    }
  }

  async deleteEmbedding(id: string): Promise<void> {
    await fetch(`${this.url}/embeddings?id=eq.${id}`, {
      method: "DELETE",
      headers: this.headers,
    });
  }

  async deleteEmbeddingsBySource(source: string, projectSlug?: string): Promise<void> {
    let filter = `source=eq.${source}`;
    if (projectSlug) filter += `&project_slug=eq.${projectSlug}`;
    await fetch(`${this.url}/embeddings?${filter}`, {
      method: "DELETE",
      headers: this.headers,
    });
  }

  async clearAll(): Promise<void> {
    // PostgREST requires a filter for DELETE; neq on the id PK matches all rows.
    for (const table of [
      "llm_messages",
      "llm_conversations",
      "llm_memory",
      "llm_skills",
      "llm_traces",
      "llm_artifacts",
      "embeddings",
    ]) {
      await fetch(`${this.url}/${table}?id=neq.___impossible___`, {
        method: "DELETE",
        headers: this.headers,
      });
    }
  }
}

function supabaseSnippet(parts: string, query: string, maxLen = 120): string {
  try {
    const parsed = JSON.parse(parts) as Array<{ type: string; text?: string }>;
    const text = parsed
      .filter((p) => p.type === "text")
      .map((p) => p.text ?? "")
      .join(" ");
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text.slice(0, maxLen);
    const start = Math.max(0, idx - 40);
    const end = Math.min(text.length, idx + query.length + 80);
    return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
  } catch {
    return parts.slice(0, maxLen);
  }
}

function rowToConversation(r: Record<string, unknown>): LlmConversationRow {
  return {
    id: r.id as string,
    title: r.title as string,
    projectSlug: (r.project_slug as string | null) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function rowToMemory(r: Record<string, unknown>): LlmMemoryRow {
  return {
    id: r.id as string,
    key: r.key as string,
    value: r.value as string,
    embedding: (r.embedding as string | null) ?? null,
    projectSlug: (r.project_slug as string | null) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function rowToArtifact(r: Record<string, unknown>): AssistantArtifactRow {
  return {
    id: r.id as string,
    projectSlug: (r.project_slug as string | null) ?? null,
    mode: r.mode as AssistantArtifactRow["mode"],
    title: r.title as string,
    summary: r.summary as string,
    body: r.body as string,
    contentType: (r.content_type as AssistantArtifactContentType | null) ?? "markdown",
    status: r.status as AssistantArtifactRow["status"],
    sourceConversationId: (r.source_conversation_id as string | null) ?? null,
    createdAt: r.created_at as string,
    nextMode: (r.next_mode as AssistantArtifactRow["nextMode"]) ?? null,
    nextReason: (r.next_reason as string | null) ?? null,
    evidenceRefs: parseArtifactEvidenceRefs(r.evidence_refs),
  };
}

function rowToEmbedding(r: Record<string, unknown>): EmbeddingRow {
  return {
    id: r.id as string,
    source: r.source as string,
    sourceId: r.source_id as string,
    text: r.text as string,
    embedding: r.embedding as string,
    modelId: r.model_id as string,
    dimensions: r.dimensions as number,
    projectSlug: (r.project_slug as string | null) ?? null,
    metadata: (r.metadata as string | null) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function parseArtifactEvidenceRefs(raw: unknown): AssistantArtifactRow["evidenceRefs"] {
  if (typeof raw !== "string" || raw.length === 0) return [];
  try {
    const parsed = JSON.parse(raw) as AssistantArtifactRow["evidenceRefs"];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
