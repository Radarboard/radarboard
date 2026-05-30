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
  PlanetscaleConfig,
} from "@radarboard/types/database";

export class PlanetscaleLlmRepository implements LlmRepository {
  private config: PlanetscaleConfig;

  constructor(config: PlanetscaleConfig) {
    this.config = config;
  }

  private async query(
    sql: string,
    args: unknown[] = []
  ): Promise<{ rows: Record<string, unknown>[] }> {
    const res = await fetch(`https://${this.config.host}/v1/query`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${this.config.username}:${this.config.password}`
        ).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql, args }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`PlanetScale query failed: ${res.status} ${text}`);
    }
    const data = (await res.json()) as { rows?: Record<string, unknown>[] };
    return { rows: data.rows ?? [] };
  }

  // --- Conversations ---

  async listConversations(): Promise<LlmConversationRow[]> {
    const result = await this.query(
      "SELECT id, title, project_slug, created_at, updated_at FROM llm_conversations ORDER BY updated_at DESC"
    );
    return result.rows.map(rowToConversation);
  }

  async createConversation(id: string, title: string, projectSlug: string | null): Promise<void> {
    const now = new Date().toISOString();
    await this.query(
      `INSERT INTO llm_conversations (id, title, project_slug, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE title = VALUES(title), updated_at = VALUES(updated_at)`,
      [id, title, projectSlug, now, now]
    );
  }

  async updateConversationTitle(id: string, title: string): Promise<void> {
    const now = new Date().toISOString();
    await this.query(`UPDATE llm_conversations SET title = ?, updated_at = ? WHERE id = ?`, [
      title,
      now,
      id,
    ]);
  }

  async deleteConversation(id: string): Promise<void> {
    await this.query("DELETE FROM llm_messages WHERE conversation_id = ?", [id]);
    await this.query("DELETE FROM llm_conversations WHERE id = ?", [id]);
  }

  // --- Messages ---

  async getMessages(conversationId: string): Promise<LlmMessageRow[]> {
    const result = await this.query(
      "SELECT id, conversation_id, role, parts, created_at FROM llm_messages WHERE conversation_id = ? ORDER BY created_at ASC",
      [conversationId]
    );
    return result.rows.map((r) => ({
      id: r.id as string,
      conversationId: r.conversation_id as string,
      role: r.role as string,
      parts: r.parts as string,
      createdAt: r.created_at as string,
    }));
  }

  async appendMessage(msg: LlmMessageRow): Promise<void> {
    await this.query(
      `INSERT INTO llm_messages (id, conversation_id, role, parts, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [msg.id, msg.conversationId, msg.role, msg.parts, msg.createdAt]
    );
  }

  // --- Memory ---

  async listMemory(projectSlug?: string): Promise<LlmMemoryRow[]> {
    if (projectSlug) {
      const result = await this.query(
        "SELECT id, key, value, embedding, project_slug, created_at, updated_at FROM llm_memory WHERE project_slug = ? ORDER BY updated_at DESC",
        [projectSlug]
      );
      return result.rows.map(rowToMemory);
    }
    const result = await this.query(
      "SELECT id, key, value, embedding, project_slug, created_at, updated_at FROM llm_memory ORDER BY updated_at DESC"
    );
    return result.rows.map(rowToMemory);
  }

  async upsertMemory(entry: LlmMemoryRow): Promise<void> {
    await this.query(
      `INSERT INTO llm_memory (id, key, value, embedding, project_slug, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE value = VALUES(value), embedding = VALUES(embedding), updated_at = VALUES(updated_at)`,
      [
        entry.id,
        entry.key,
        entry.value,
        entry.embedding,
        entry.projectSlug,
        entry.createdAt,
        entry.updatedAt,
      ]
    );
  }

  async deleteMemory(id: string): Promise<void> {
    await this.query("DELETE FROM llm_memory WHERE id = ?", [id]);
  }

  // --- Custom Skills ---

  async listSkills(): Promise<LlmSkillRow[]> {
    const result = await this.query(
      "SELECT id, name, description, instructions, enabled, created_at, updated_at FROM llm_skills ORDER BY name ASC"
    );
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
    await this.query(
      `INSERT INTO llm_skills (id, name, description, instructions, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description),
         instructions = VALUES(instructions), enabled = VALUES(enabled), updated_at = VALUES(updated_at)`,
      [
        skill.id,
        skill.name,
        skill.description,
        skill.instructions,
        skill.enabled ? 1 : 0,
        skill.createdAt,
        skill.updatedAt,
      ]
    );
  }

  async deleteSkill(id: string): Promise<void> {
    await this.query("DELETE FROM llm_skills WHERE id = ?", [id]);
  }

  // --- Traces ---

  async insertTrace(trace: LlmTraceRow): Promise<void> {
    await this.query(
      `INSERT INTO llm_traces (
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
      [
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
      ]
    );
  }
  async listTraces(limit = 100): Promise<LlmTraceRow[]> {
    const { rows } = await this.query(
      `SELECT
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
      [limit]
    );
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
    await this.query(`UPDATE llm_traces SET rating = ? WHERE id = ?`, [rating, id]);
  }

  // --- Assistant workflow artifacts ---

  async listArtifacts(query: AssistantArtifactQuery = {}): Promise<AssistantArtifactRow[]> {
    const where: string[] = [];
    const args: unknown[] = [];

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

    args.push(query.limit && query.limit > 0 ? query.limit : 20);

    const { rows } = await this.query(
      `SELECT
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
      args
    );
    return rows.map(rowToArtifact);
  }

  async getArtifact(id: string): Promise<AssistantArtifactRow | null> {
    const { rows } = await this.query(
      `SELECT
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
      [id]
    );
    return rows[0] ? rowToArtifact(rows[0]) : null;
  }

  async upsertArtifact(artifact: AssistantArtifactRow): Promise<void> {
    await this.query(
      `INSERT INTO llm_artifacts (
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
       ON DUPLICATE KEY UPDATE
         project_slug = VALUES(project_slug),
         mode = VALUES(mode),
         title = VALUES(title),
         summary = VALUES(summary),
         body = VALUES(body),
         content_type = VALUES(content_type),
         status = VALUES(status),
         source_conversation_id = VALUES(source_conversation_id),
         created_at = VALUES(created_at),
         next_mode = VALUES(next_mode),
         next_reason = VALUES(next_reason),
         evidence_refs = VALUES(evidence_refs)`,
      [
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
      ]
    );
  }

  async searchMessages(query: string, limit = 20): Promise<LlmMessageSearchResult[]> {
    const pattern = `%${query}%`;
    const { rows } = await this.query(
      `SELECT m.conversation_id, c.title, m.id AS message_id, m.role, m.parts
       FROM llm_messages m
       JOIN llm_conversations c ON c.id = m.conversation_id
       WHERE m.parts LIKE ?
       ORDER BY m.created_at DESC
       LIMIT ?`,
      [pattern, limit]
    );
    return rows.map((r) => ({
      conversationId: r.conversation_id as string,
      conversationTitle: r.title as string,
      messageId: r.message_id as string,
      role: r.role as string,
      snippet: psSnippet(r.parts as string, query),
    }));
  }

  // --- Embeddings ---

  async listEmbeddings(source?: string, projectSlug?: string): Promise<EmbeddingRow[]> {
    let sql =
      "SELECT id, source, source_id, text, embedding, model_id, dimensions, project_slug, metadata, created_at, updated_at FROM embeddings";
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
    if (conditions.length) sql += ` WHERE ${conditions.join(" AND ")}`;
    sql += " ORDER BY updated_at DESC";
    const result = await this.query(sql, args);
    return result.rows.map(psRowToEmbedding);
  }

  async upsertEmbedding(row: EmbeddingRow): Promise<void> {
    await this.query(
      `INSERT INTO embeddings (id, source, source_id, text, embedding, model_id, dimensions, project_slug, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE text = VALUES(text), embedding = VALUES(embedding), model_id = VALUES(model_id), dimensions = VALUES(dimensions), metadata = VALUES(metadata), updated_at = VALUES(updated_at)`,
      [
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
      ]
    );
  }

  async upsertEmbeddings(rows: EmbeddingRow[]): Promise<void> {
    for (const row of rows) {
      await this.upsertEmbedding(row);
    }
  }

  async deleteEmbedding(id: string): Promise<void> {
    await this.query("DELETE FROM embeddings WHERE id = ?", [id]);
  }

  async deleteEmbeddingsBySource(source: string, projectSlug?: string): Promise<void> {
    if (projectSlug) {
      await this.query("DELETE FROM embeddings WHERE source = ? AND project_slug = ?", [
        source,
        projectSlug,
      ]);
    } else {
      await this.query("DELETE FROM embeddings WHERE source = ?", [source]);
    }
  }
}

function psSnippet(parts: string, query: string, maxLen = 120): string {
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

function psRowToEmbedding(r: Record<string, unknown>): EmbeddingRow {
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
