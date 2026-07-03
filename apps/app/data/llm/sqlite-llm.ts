import type {
  AssistantArtifactContentType,
  AssistantArtifactQuery,
  AssistantArtifactRow,
  AssistantArtifactStatus,
  AssistantMode,
  EmbeddingRow,
  LlmConversationRow,
  LlmMemoryRow,
  LlmMessageRow,
  LlmMessageSearchResult,
  LlmRepository,
  LlmSkillRow,
  LlmTraceRow,
} from "@radarboard/types/database";
import { and, desc, eq, type SQL, sql } from "drizzle-orm";
import { getDb } from "@/data/core/client";
import {
  embeddings,
  llmArtifacts,
  llmConversations,
  llmMemory,
  llmMessages,
  llmSkills,
  llmTraces,
} from "@/data/core/schema";

const LLM_DDL = [
  `CREATE TABLE IF NOT EXISTS llm_traces (
    id TEXT PRIMARY KEY,
    conversation_id TEXT,
    provider_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    rating INTEGER,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS llm_traces_conv_idx ON llm_traces(conversation_id)`,
  `CREATE TABLE IF NOT EXISTS llm_conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    project_slug TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS llm_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL,
    parts TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS llm_messages_conv_idx ON llm_messages(conversation_id)`,
  `CREATE TABLE IF NOT EXISTS llm_memory (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    embedding TEXT,
    project_slug TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS llm_memory_key_idx ON llm_memory(key, project_slug)`,
  `CREATE TABLE IF NOT EXISTS llm_skills (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    instructions TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS llm_artifacts (
    id TEXT PRIMARY KEY,
    project_slug TEXT,
    mode TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    body TEXT NOT NULL,
    content_type TEXT NOT NULL DEFAULT 'markdown',
    status TEXT NOT NULL,
    source_conversation_id TEXT,
    created_at TEXT NOT NULL,
    next_mode TEXT,
    next_reason TEXT,
    evidence_refs TEXT NOT NULL DEFAULT '[]'
  )`,
  `CREATE INDEX IF NOT EXISTS llm_artifacts_created_idx ON llm_artifacts(created_at)`,
  `CREATE INDEX IF NOT EXISTS llm_artifacts_project_idx ON llm_artifacts(project_slug, created_at)`,
  `CREATE INDEX IF NOT EXISTS llm_artifacts_mode_idx ON llm_artifacts(mode, created_at)`,
  `CREATE INDEX IF NOT EXISTS llm_artifacts_conv_idx ON llm_artifacts(source_conversation_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS embeddings (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    source_id TEXT NOT NULL,
    text TEXT NOT NULL,
    embedding TEXT NOT NULL,
    model_id TEXT NOT NULL,
    dimensions INTEGER NOT NULL,
    project_slug TEXT,
    metadata TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS embeddings_source_id_idx ON embeddings(source, source_id)`,
  `CREATE INDEX IF NOT EXISTS embeddings_source_idx ON embeddings(source)`,
  `CREATE INDEX IF NOT EXISTS embeddings_project_idx ON embeddings(project_slug)`,
];

export class SqliteLlmRepository implements LlmRepository {
  private initialized = false;
  private artifactColumnsReady = false;

  private async ensureTables(): Promise<void> {
    if (this.initialized) return;
    const db = getDb();
    for (const ddl of LLM_DDL) {
      await db.run(sql.raw(ddl));
    }
    this.initialized = true;
    await this.ensureArtifactColumns();
  }

  private async ensureArtifactColumns(): Promise<void> {
    if (this.artifactColumnsReady) return;
    const db = getDb();
    const info = await db.all<{ name: string }>(sql.raw("PRAGMA table_info(llm_artifacts)"));
    const existing = new Set(info.map((row) => row.name));

    if (!existing.has("content_type")) {
      await db.run(
        sql.raw("ALTER TABLE llm_artifacts ADD COLUMN content_type TEXT DEFAULT 'markdown'")
      );
    }
    if (!existing.has("evidence_refs")) {
      await db.run(sql.raw("ALTER TABLE llm_artifacts ADD COLUMN evidence_refs TEXT DEFAULT '[]'"));
    }

    this.artifactColumnsReady = true;
  }

  // --- Conversations ---

  async listConversations(): Promise<LlmConversationRow[]> {
    await this.ensureTables();
    const db = getDb();
    return db.select().from(llmConversations).orderBy(desc(llmConversations.updatedAt));
  }

  async createConversation(id: string, title: string, projectSlug: string | null): Promise<void> {
    await this.ensureTables();
    const db = getDb();
    const now = new Date().toISOString();
    await db
      .insert(llmConversations)
      .values({ id, title, projectSlug, createdAt: now, updatedAt: now });
  }

  async updateConversationTitle(id: string, title: string): Promise<void> {
    await this.ensureTables();
    const db = getDb();
    const now = new Date().toISOString();
    await db
      .update(llmConversations)
      .set({ title, updatedAt: now })
      .where(eq(llmConversations.id, id));
  }

  async deleteConversation(id: string): Promise<void> {
    await this.ensureTables();
    const db = getDb();
    await db.delete(llmMessages).where(eq(llmMessages.conversationId, id));
    await db.delete(llmConversations).where(eq(llmConversations.id, id));
  }

  // --- Messages ---

  async getMessages(conversationId: string): Promise<LlmMessageRow[]> {
    await this.ensureTables();
    const db = getDb();
    return db
      .select()
      .from(llmMessages)
      .where(eq(llmMessages.conversationId, conversationId))
      .orderBy(llmMessages.createdAt);
  }

  async appendMessage(msg: LlmMessageRow): Promise<void> {
    await this.ensureTables();
    const db = getDb();
    await db.insert(llmMessages).values(msg);
  }

  async searchMessages(query: string, limit = 20): Promise<LlmMessageSearchResult[]> {
    await this.ensureTables();
    const db = getDb();
    const pattern = `%${query}%`;
    const rows = await db.all<{
      conversation_id: string;
      title: string;
      message_id: string;
      role: string;
      parts: string;
    }>(
      sql.raw(`
        SELECT m.conversation_id, c.title, m.id AS message_id, m.role, m.parts
        FROM llm_messages m
        JOIN llm_conversations c ON c.id = m.conversation_id
        WHERE m.parts LIKE '${pattern.replace(/'/g, "''")}'
        ORDER BY m.created_at DESC
        LIMIT ${limit}
      `)
    );
    return rows.map((r) => ({
      conversationId: r.conversation_id,
      conversationTitle: r.title,
      messageId: r.message_id,
      role: r.role,
      snippet: extractSnippet(r.parts, query),
    }));
  }

  // --- Memory ---

  async listMemory(projectSlug?: string): Promise<LlmMemoryRow[]> {
    await this.ensureTables();
    const db = getDb();
    if (projectSlug) {
      return db
        .select()
        .from(llmMemory)
        .where(eq(llmMemory.projectSlug, projectSlug))
        .orderBy(desc(llmMemory.updatedAt));
    }
    return db.select().from(llmMemory).orderBy(desc(llmMemory.updatedAt));
  }

  async upsertMemory(entry: LlmMemoryRow): Promise<void> {
    await this.ensureTables();
    const db = getDb();
    await db
      .insert(llmMemory)
      .values(entry)
      .onConflictDoUpdate({
        target: llmMemory.id,
        set: { value: entry.value, embedding: entry.embedding, updatedAt: entry.updatedAt },
      });
  }

  async deleteMemory(id: string): Promise<void> {
    await this.ensureTables();
    const db = getDb();
    await db.delete(llmMemory).where(eq(llmMemory.id, id));
  }

  // --- Custom Skills ---

  async listSkills(): Promise<LlmSkillRow[]> {
    await this.ensureTables();
    const db = getDb();
    return db.select().from(llmSkills).orderBy(llmSkills.name);
  }

  async upsertSkill(skill: LlmSkillRow): Promise<void> {
    await this.ensureTables();
    const db = getDb();
    await db
      .insert(llmSkills)
      .values(skill)
      .onConflictDoUpdate({
        target: llmSkills.id,
        set: {
          name: skill.name,
          description: skill.description,
          instructions: skill.instructions,
          enabled: skill.enabled,
          updatedAt: skill.updatedAt,
        },
      });
  }

  async deleteSkill(id: string): Promise<void> {
    await this.ensureTables();
    const db = getDb();
    await db.delete(llmSkills).where(eq(llmSkills.id, id));
  }

  // --- Traces ---

  async insertTrace(trace: LlmTraceRow): Promise<void> {
    await this.ensureTables();
    const db = getDb();
    await db.insert(llmTraces).values(trace);
  }

  async listTraces(limit = 100): Promise<LlmTraceRow[]> {
    await this.ensureTables();
    const db = getDb();
    const rows = await db.select().from(llmTraces).orderBy(desc(llmTraces.createdAt)).limit(limit);
    return rows.map((r) => ({
      id: r.id,
      conversationId: r.conversationId,
      providerId: r.providerId,
      modelId: r.modelId,
      promptTokens: r.promptTokens,
      completionTokens: r.completionTokens,
      totalTokens: r.totalTokens,
      durationMs: r.durationMs,
      rating: r.rating ?? null,
      createdAt: r.createdAt,
    }));
  }

  async updateTraceRating(id: string, rating: number | null): Promise<void> {
    await this.ensureTables();
    const db = getDb();
    await db.update(llmTraces).set({ rating }).where(eq(llmTraces.id, id));
  }

  // --- Assistant workflow artifacts ---

  async listArtifacts(query: AssistantArtifactQuery = {}): Promise<AssistantArtifactRow[]> {
    await this.ensureTables();
    const db = getDb();

    const conditions: SQL[] = [];
    if (query.projectSlug) {
      conditions.push(eq(llmArtifacts.projectSlug, query.projectSlug));
    }
    if (query.mode) {
      conditions.push(eq(llmArtifacts.mode, query.mode));
    }
    if (query.sourceConversationId) {
      conditions.push(eq(llmArtifacts.sourceConversationId, query.sourceConversationId));
    }

    const baseQb = db
      .select()
      .from(llmArtifacts)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(llmArtifacts.createdAt));

    const rows = query.limit && query.limit > 0 ? await baseQb.limit(query.limit) : await baseQb;

    return rows.map((row) => ({
      ...row,
      contentType: (row.contentType as AssistantArtifactContentType | null) ?? "markdown",
      mode: row.mode as AssistantMode,
      status: row.status as AssistantArtifactStatus,
      nextMode: (row.nextMode as AssistantMode | null) ?? null,
      evidenceRefs: parseArtifactEvidenceRefs(row.evidenceRefs),
    }));
  }

  async getArtifact(id: string): Promise<AssistantArtifactRow | null> {
    await this.ensureTables();
    const db = getDb();
    const row = await db.select().from(llmArtifacts).where(eq(llmArtifacts.id, id)).get();
    return row
      ? {
          ...row,
          contentType: (row.contentType as AssistantArtifactContentType | null) ?? "markdown",
          mode: row.mode as AssistantMode,
          status: row.status as AssistantArtifactStatus,
          nextMode: (row.nextMode as AssistantMode | null) ?? null,
          evidenceRefs: parseArtifactEvidenceRefs(row.evidenceRefs),
        }
      : null;
  }

  async upsertArtifact(artifact: AssistantArtifactRow): Promise<void> {
    await this.ensureTables();
    const db = getDb();
    await db
      .insert(llmArtifacts)
      .values({ ...artifact, evidenceRefs: JSON.stringify(artifact.evidenceRefs) })
      .onConflictDoUpdate({
        target: llmArtifacts.id,
        set: {
          projectSlug: artifact.projectSlug,
          mode: artifact.mode,
          title: artifact.title,
          summary: artifact.summary,
          body: artifact.body,
          contentType: artifact.contentType,
          status: artifact.status,
          sourceConversationId: artifact.sourceConversationId,
          createdAt: artifact.createdAt,
          nextMode: artifact.nextMode,
          nextReason: artifact.nextReason,
          evidenceRefs: JSON.stringify(artifact.evidenceRefs),
        },
      });
  }

  // --- Embeddings ---

  async listEmbeddings(source?: string, projectSlug?: string): Promise<EmbeddingRow[]> {
    await this.ensureTables();
    const db = getDb();
    const conditions: SQL[] = [];
    if (source) conditions.push(eq(embeddings.source, source));
    if (projectSlug) conditions.push(eq(embeddings.projectSlug, projectSlug));
    const rows = await db
      .select()
      .from(embeddings)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(embeddings.updatedAt));
    return rows as EmbeddingRow[];
  }

  async upsertEmbedding(row: EmbeddingRow): Promise<void> {
    await this.ensureTables();
    const db = getDb();
    await db
      .insert(embeddings)
      .values(row)
      .onConflictDoUpdate({
        target: embeddings.id,
        set: {
          text: row.text,
          embedding: row.embedding,
          modelId: row.modelId,
          dimensions: row.dimensions,
          metadata: row.metadata,
          updatedAt: row.updatedAt,
        },
      });
  }

  async upsertEmbeddings(rows: EmbeddingRow[]): Promise<void> {
    for (const row of rows) {
      await this.upsertEmbedding(row);
    }
  }

  async deleteEmbedding(id: string): Promise<void> {
    await this.ensureTables();
    const db = getDb();
    await db.delete(embeddings).where(eq(embeddings.id, id));
  }

  async deleteEmbeddingsBySource(source: string, projectSlug?: string): Promise<void> {
    await this.ensureTables();
    const db = getDb();
    const conditions = [eq(embeddings.source, source)];
    if (projectSlug) conditions.push(eq(embeddings.projectSlug, projectSlug));
    await db.delete(embeddings).where(and(...conditions));
  }

  async clearAll(): Promise<void> {
    await this.ensureTables();
    const db = getDb();
    await db.delete(llmMessages);
    await db.delete(llmConversations);
    await db.delete(llmMemory);
    await db.delete(llmSkills);
    await db.delete(llmTraces);
    await db.delete(llmArtifacts);
    await db.delete(embeddings);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractSnippet(parts: string, query: string, maxLen = 120): string {
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

function parseArtifactEvidenceRefs(raw: unknown): AssistantArtifactRow["evidenceRefs"] {
  if (typeof raw !== "string" || raw.length === 0) return [];
  try {
    const parsed = JSON.parse(raw) as AssistantArtifactRow["evidenceRefs"];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
