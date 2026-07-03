import { createClient } from "@libsql/client";
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
  TursoConfig,
} from "@radarboard/types/database";

export class TursoLlmRepository implements LlmRepository {
  private client: ReturnType<typeof createClient>;

  constructor(config: TursoConfig) {
    this.client = createClient({ url: config.url, authToken: config.authToken });
  }

  // --- Conversations ---

  async listConversations(): Promise<LlmConversationRow[]> {
    const result = await this.client.execute({
      sql: "SELECT id, title, project_slug, created_at, updated_at FROM llm_conversations ORDER BY updated_at DESC",
      args: [],
    });
    return result.rows.map((r) => ({
      id: r.id as string,
      title: r.title as string,
      projectSlug: (r.project_slug as string | null) ?? null,
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
    }));
  }

  async createConversation(id: string, title: string, projectSlug: string | null): Promise<void> {
    const now = new Date().toISOString();
    await this.client.execute({
      sql: `INSERT INTO llm_conversations (id, title, project_slug, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)`,
      args: [id, title, projectSlug, now, now],
    });
  }

  async updateConversationTitle(id: string, title: string): Promise<void> {
    const now = new Date().toISOString();
    await this.client.execute({
      sql: "UPDATE llm_conversations SET title = ?, updated_at = ? WHERE id = ?",
      args: [title, now, id],
    });
  }

  async deleteConversation(id: string): Promise<void> {
    await this.client.execute({
      sql: "DELETE FROM llm_messages WHERE conversation_id = ?",
      args: [id],
    });
    await this.client.execute({
      sql: "DELETE FROM llm_conversations WHERE id = ?",
      args: [id],
    });
  }

  // --- Messages ---

  async getMessages(conversationId: string): Promise<LlmMessageRow[]> {
    const result = await this.client.execute({
      sql: "SELECT id, conversation_id, role, parts, created_at FROM llm_messages WHERE conversation_id = ? ORDER BY created_at ASC",
      args: [conversationId],
    });
    return result.rows.map((r) => ({
      id: r.id as string,
      conversationId: r.conversation_id as string,
      role: r.role as string,
      parts: r.parts as string,
      createdAt: r.created_at as string,
    }));
  }

  async appendMessage(msg: LlmMessageRow): Promise<void> {
    await this.client.execute({
      sql: `INSERT INTO llm_messages (id, conversation_id, role, parts, created_at)
            VALUES (?, ?, ?, ?, ?)`,
      args: [msg.id, msg.conversationId, msg.role, msg.parts, msg.createdAt],
    });
  }

  // --- Memory ---

  async listMemory(projectSlug?: string): Promise<LlmMemoryRow[]> {
    if (projectSlug) {
      const result = await this.client.execute({
        sql: "SELECT id, key, value, embedding, project_slug, created_at, updated_at FROM llm_memory WHERE project_slug = ? ORDER BY updated_at DESC",
        args: [projectSlug],
      });
      return result.rows.map(rowToMemory);
    }
    const result = await this.client.execute({
      sql: "SELECT id, key, value, embedding, project_slug, created_at, updated_at FROM llm_memory ORDER BY updated_at DESC",
      args: [],
    });
    return result.rows.map(rowToMemory);
  }

  async upsertMemory(entry: LlmMemoryRow): Promise<void> {
    await this.client.execute({
      sql: `INSERT INTO llm_memory (id, key, value, embedding, project_slug, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET value = ?, embedding = ?, updated_at = ?`,
      args: [
        entry.id,
        entry.key,
        entry.value,
        entry.embedding,
        entry.projectSlug,
        entry.createdAt,
        entry.updatedAt,
        entry.value,
        entry.embedding,
        entry.updatedAt,
      ],
    });
  }

  async deleteMemory(id: string): Promise<void> {
    await this.client.execute({ sql: "DELETE FROM llm_memory WHERE id = ?", args: [id] });
  }

  // --- Custom Skills ---

  async listSkills(): Promise<LlmSkillRow[]> {
    const result = await this.client.execute({
      sql: "SELECT id, name, description, instructions, enabled, created_at, updated_at FROM llm_skills ORDER BY name ASC",
      args: [],
    });
    return result.rows.map((r) => ({
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
    await this.client.execute({
      sql: `INSERT INTO llm_skills (id, name, description, instructions, enabled, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET name = ?, description = ?, instructions = ?, enabled = ?, updated_at = ?`,
      args: [
        skill.id,
        skill.name,
        skill.description,
        skill.instructions,
        skill.enabled ? 1 : 0,
        skill.createdAt,
        skill.updatedAt,
        skill.name,
        skill.description,
        skill.instructions,
        skill.enabled ? 1 : 0,
        skill.updatedAt,
      ],
    });
  }

  async deleteSkill(id: string): Promise<void> {
    await this.client.execute({ sql: "DELETE FROM llm_skills WHERE id = ?", args: [id] });
  }

  // --- Traces ---

  async insertTrace(trace: LlmTraceRow): Promise<void> {
    await this.client.execute({
      sql: `INSERT INTO llm_traces (
              id,
              conversation_id,
              provider_id,
              model_id,
              prompt_tokens,
              completion_tokens,
              total_tokens,
              duration_ms,
              rating,
              created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        trace.id,
        trace.conversationId,
        trace.providerId,
        trace.modelId,
        trace.promptTokens,
        trace.completionTokens,
        trace.totalTokens,
        trace.durationMs,
        trace.rating,
        trace.createdAt,
      ],
    });
  }
  async listTraces(limit = 100): Promise<LlmTraceRow[]> {
    const result = await this.client.execute({
      sql: `SELECT
              id,
              conversation_id,
              provider_id,
              model_id,
              prompt_tokens,
              completion_tokens,
              total_tokens,
              duration_ms,
              rating,
              created_at
            FROM llm_traces
            ORDER BY created_at DESC
            LIMIT ?`,
      args: [limit],
    });
    return result.rows.map((r) => ({
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
    await this.client.execute({
      sql: "UPDATE llm_traces SET rating = ? WHERE id = ?",
      args: [rating, id],
    });
  }

  // --- Assistant workflow artifacts ---

  async listArtifacts(query: AssistantArtifactQuery = {}): Promise<AssistantArtifactRow[]> {
    const where: string[] = [];
    const args: Array<string | number> = [];

    if (query.projectSlug) {
      where.push("project_slug = ?");
      args.push(query.projectSlug);
    }
    if (query.mode) {
      where.push("mode = ?");
      args.push(query.mode);
    }
    if (query.sourceConversationId) {
      where.push("source_conversation_id = ?");
      args.push(query.sourceConversationId);
    }

    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    args.push(limit);

    const result = await this.client.execute({
      sql: `SELECT
              id,
              project_slug,
              mode,
              title,
              summary,
              body,
              content_type,
              status,
              source_conversation_id,
              created_at,
              next_mode,
              next_reason,
              evidence_refs
            FROM llm_artifacts
            ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
            ORDER BY created_at DESC
            LIMIT ?`,
      args,
    });

    return result.rows.map(rowToArtifact);
  }

  async getArtifact(id: string): Promise<AssistantArtifactRow | null> {
    const result = await this.client.execute({
      sql: `SELECT
              id,
              project_slug,
              mode,
              title,
              summary,
              body,
              content_type,
              status,
              source_conversation_id,
              created_at,
              next_mode,
              next_reason,
              evidence_refs
            FROM llm_artifacts
            WHERE id = ?
            LIMIT 1`,
      args: [id],
    });

    const row = result.rows[0];
    return row ? rowToArtifact(row) : null;
  }

  async upsertArtifact(artifact: AssistantArtifactRow): Promise<void> {
    await this.client.execute({
      sql: `INSERT INTO llm_artifacts (
              id,
              project_slug,
              mode,
              title,
              summary,
              body,
              content_type,
              status,
              source_conversation_id,
              created_at,
              next_mode,
              next_reason,
              evidence_refs
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              project_slug = ?,
              mode = ?,
              title = ?,
              summary = ?,
              body = ?,
              content_type = ?,
              status = ?,
              source_conversation_id = ?,
              created_at = ?,
              next_mode = ?,
              next_reason = ?,
              evidence_refs = ?`,
      args: [
        artifact.id,
        artifact.projectSlug,
        artifact.mode,
        artifact.title,
        artifact.summary,
        artifact.body,
        artifact.contentType,
        artifact.status,
        artifact.sourceConversationId,
        artifact.createdAt,
        artifact.nextMode,
        artifact.nextReason,
        JSON.stringify(artifact.evidenceRefs),
        artifact.projectSlug,
        artifact.mode,
        artifact.title,
        artifact.summary,
        artifact.body,
        artifact.contentType,
        artifact.status,
        artifact.sourceConversationId,
        artifact.createdAt,
        artifact.nextMode,
        artifact.nextReason,
        JSON.stringify(artifact.evidenceRefs),
      ],
    });
  }

  async searchMessages(query: string, limit = 20): Promise<LlmMessageSearchResult[]> {
    const pattern = `%${query}%`;
    const result = await this.client.execute({
      sql: `SELECT m.conversation_id, c.title, m.id AS message_id, m.role, m.parts
            FROM llm_messages m
            JOIN llm_conversations c ON c.id = m.conversation_id
            WHERE m.parts LIKE ?
            ORDER BY m.created_at DESC
            LIMIT ?`,
      args: [pattern, limit],
    });
    return result.rows.map((r) => ({
      conversationId: r.conversation_id as string,
      conversationTitle: r.title as string,
      messageId: r.message_id as string,
      role: r.role as string,
      snippet: tursoSnippet(r.parts as string, query),
    }));
  }

  // --- Embeddings ---

  async listEmbeddings(source?: string, projectSlug?: string): Promise<EmbeddingRow[]> {
    let where = "";
    const args: string[] = [];
    const conditions: string[] = [];
    if (source) {
      conditions.push("source = ?");
      args.push(source);
    }
    if (projectSlug) {
      conditions.push("project_slug = ?");
      args.push(projectSlug);
    }
    if (conditions.length) where = `WHERE ${conditions.join(" AND ")}`;
    const result = await this.client.execute({
      sql: `SELECT id, source, source_id, text, embedding, model_id, dimensions, project_slug, metadata, created_at, updated_at FROM embeddings ${where} ORDER BY updated_at DESC`,
      args,
    });
    return result.rows.map((r) => ({
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
    }));
  }

  async upsertEmbedding(row: EmbeddingRow): Promise<void> {
    await this.client.execute({
      sql: `INSERT INTO embeddings (id, source, source_id, text, embedding, model_id, dimensions, project_slug, metadata, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET text = ?, embedding = ?, model_id = ?, dimensions = ?, metadata = ?, updated_at = ?`,
      args: [
        row.id,
        row.source,
        row.sourceId,
        row.text,
        row.embedding,
        row.modelId,
        row.dimensions,
        row.projectSlug,
        row.metadata,
        row.createdAt,
        row.updatedAt,
        row.text,
        row.embedding,
        row.modelId,
        row.dimensions,
        row.metadata,
        row.updatedAt,
      ],
    });
  }

  async upsertEmbeddings(rows: EmbeddingRow[]): Promise<void> {
    for (const row of rows) {
      await this.upsertEmbedding(row);
    }
  }

  async deleteEmbedding(id: string): Promise<void> {
    await this.client.execute({ sql: "DELETE FROM embeddings WHERE id = ?", args: [id] });
  }

  async deleteEmbeddingsBySource(source: string, projectSlug?: string): Promise<void> {
    if (projectSlug) {
      await this.client.execute({
        sql: "DELETE FROM embeddings WHERE source = ? AND project_slug = ?",
        args: [source, projectSlug],
      });
    } else {
      await this.client.execute({ sql: "DELETE FROM embeddings WHERE source = ?", args: [source] });
    }
  }

  async clearAll(): Promise<void> {
    for (const table of [
      "llm_messages",
      "llm_conversations",
      "llm_memory",
      "llm_skills",
      "llm_traces",
      "llm_artifacts",
      "embeddings",
    ]) {
      await this.client.execute({ sql: `DELETE FROM ${table}`, args: [] });
    }
  }
}

function tursoSnippet(parts: string, query: string, maxLen = 120): string {
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

function parseArtifactEvidenceRefs(raw: unknown): AssistantArtifactRow["evidenceRefs"] {
  if (typeof raw !== "string" || raw.length === 0) return [];
  try {
    const parsed = JSON.parse(raw) as AssistantArtifactRow["evidenceRefs"];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
