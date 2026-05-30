import { API_ROUTES } from "@radarboard/types/api-routes";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildKnowledgeHealthItemDetail,
  buildKnowledgeHealthItems,
  buildKnowledgeHealthSummary,
} from "../knowledge-health";

const mockQueryDebugEvents = vi.fn();

vi.mock("@/lib/debug-events", () => ({
  queryDebugEvents: (query: unknown) => mockQueryDebugEvents(query),
}));

const mockRepo = {
  listConversations: vi.fn(),
  createConversation: vi.fn(),
  updateConversationTitle: vi.fn(),
  deleteConversation: vi.fn(),
  getMessages: vi.fn(),
  appendMessage: vi.fn(),
  searchMessages: vi.fn(),
  listMemory: vi.fn(),
  upsertMemory: vi.fn(),
  deleteMemory: vi.fn(),
  listSkills: vi.fn(),
  upsertSkill: vi.fn(),
  deleteSkill: vi.fn(),
  insertTrace: vi.fn(),
  listTraces: vi.fn(),
  updateTraceRating: vi.fn(),
  listArtifacts: vi.fn(),
  getArtifact: vi.fn(),
  upsertArtifact: vi.fn(),
};

function baseTrace(id: string, createdAt: string, rating: number | null = null) {
  return {
    id,
    conversationId: `conv-${id}`,
    providerId: "openai",
    modelId: "gpt-5.4-mini",
    promptTokens: 10,
    completionTokens: 20,
    totalTokens: 30,
    durationMs: 1200,
    rating,
    createdAt,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-03-20T12:00:00.000Z"));
  vi.clearAllMocks();
  mockRepo.listMemory.mockResolvedValue([]);
  mockRepo.listArtifacts.mockResolvedValue([]);
  mockRepo.listTraces.mockResolvedValue([]);
  mockQueryDebugEvents.mockResolvedValue([]);
});

describe("knowledge-health service", () => {
  it("keeps ambiguous memory keys inferred and uncounted", async () => {
    mockRepo.listMemory.mockResolvedValue([
      {
        id: "mem-1",
        key: "shared",
        value: "one",
        embedding: null,
        projectSlug: "alpha",
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      },
      {
        id: "mem-2",
        key: "shared",
        value: "two",
        embedding: null,
        projectSlug: "beta",
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      },
    ]);
    mockRepo.listTraces.mockResolvedValue([baseTrace("trace-1", "2026-03-19T12:00:00.000Z", 1)]);
    mockQueryDebugEvents.mockResolvedValue([
      {
        id: "evt-1",
        occurredAt: "2026-03-19T12:00:00.000Z",
        ingestedAt: "2026-03-19T12:00:00.000Z",
        level: "info",
        source: "api/chat",
        eventType: "chat.context.loaded",
        message: "loaded",
        projectSlug: "alpha",
        traceId: "trace-1",
        requestId: null,
        sessionId: null,
        conversationId: "conv-trace-1",
        entityType: "conversation",
        entityId: "conv-trace-1",
        status: "completed",
        durationMs: null,
        metadata: {
          memory: { count: 1, keys: ["shared"], query: "hello" },
          context: { attachedArtifacts: [], dependencyArtifacts: [] },
        },
      },
    ]);

    const response = await buildKnowledgeHealthItems(mockRepo as never, {
      type: "memory",
      limit: 20,
    });

    expect(response.items).toHaveLength(2);
    expect(response.items[0]).toMatchObject({
      attributionQuality: "inferred",
      useCount: null,
      positiveFeedbackCount: 0,
      negativeFeedbackCount: 0,
      stale: false,
    });
  });

  it("separates Global bucket items from concrete project summaries", async () => {
    mockRepo.listMemory.mockResolvedValue([
      {
        id: "mem-global",
        key: "global-note",
        value: "shared",
        embedding: null,
        projectSlug: null,
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-01T00:00:00.000Z",
      },
      {
        id: "mem-alpha",
        key: "alpha-note",
        value: "alpha",
        embedding: null,
        projectSlug: "alpha",
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-01T00:00:00.000Z",
      },
    ]);
    mockRepo.listArtifacts.mockResolvedValue([
      {
        id: "art-global",
        projectSlug: null,
        mode: "plan",
        title: "Global Artifact",
        summary: "shared",
        body: "body",
        contentType: "markdown",
        status: "completed",
        sourceConversationId: null,
        createdAt: "2026-02-01T00:00:00.000Z",
        nextMode: null,
        nextReason: null,
        evidenceRefs: [],
      },
    ]);
    mockRepo.listTraces.mockResolvedValue([
      baseTrace("trace-global", "2026-03-18T00:00:00.000Z", 1),
      baseTrace("trace-alpha", "2026-03-17T00:00:00.000Z", -1),
    ]);
    mockQueryDebugEvents.mockResolvedValue([
      {
        id: "evt-global",
        occurredAt: "2026-03-18T00:00:00.000Z",
        ingestedAt: "2026-03-18T00:00:00.000Z",
        level: "info",
        source: "api/chat",
        eventType: "chat.context.loaded",
        message: "global load",
        projectSlug: null,
        traceId: "trace-global",
        requestId: null,
        sessionId: null,
        conversationId: "conv-trace-global",
        entityType: "conversation",
        entityId: "conv-trace-global",
        status: "completed",
        durationMs: null,
        metadata: {
          memory: { count: 0, keys: [], query: "" },
          context: {
            attachedArtifacts: [{ id: "art-global", label: "Global Artifact", kind: "artifact" }],
            dependencyArtifacts: [],
          },
        },
      },
      {
        id: "evt-alpha",
        occurredAt: "2026-03-17T00:00:00.000Z",
        ingestedAt: "2026-03-17T00:00:00.000Z",
        level: "info",
        source: "api/chat",
        eventType: "chat.context.loaded",
        message: "alpha load",
        projectSlug: "alpha",
        traceId: "trace-alpha",
        requestId: null,
        sessionId: null,
        conversationId: "conv-trace-alpha",
        entityType: "conversation",
        entityId: "conv-trace-alpha",
        status: "completed",
        durationMs: null,
        metadata: {
          memory: { count: 1, keys: ["alpha-note"], query: "" },
          context: {
            attachedArtifacts: [],
            dependencyArtifacts: [{ id: "art-global", label: "Global Artifact", kind: "artifact" }],
          },
        },
      },
    ]);

    const summary = await buildKnowledgeHealthSummary(mockRepo as never);
    expect(summary.summary.projects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          projectSlug: null,
          projectName: "Global",
          itemCount: 2,
        }),
        expect.objectContaining({
          projectSlug: "alpha",
          itemCount: 1,
        }),
      ])
    );
    const alpha = summary.summary.projects.find((project) => project.projectSlug === "alpha");
    expect(alpha?.itemCount).toBe(1);
  });

  it("counts knowledge-backed runs from attached artifacts, dependency artifacts, and memory recall", async () => {
    mockRepo.listMemory.mockResolvedValue([
      {
        id: "mem-1",
        key: "alpha",
        value: "one",
        embedding: null,
        projectSlug: "alpha",
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-01T00:00:00.000Z",
      },
    ]);
    mockRepo.listArtifacts.mockResolvedValue([
      {
        id: "art-1",
        projectSlug: "alpha",
        mode: "plan",
        title: "Plan",
        summary: "summary",
        body: "body",
        contentType: "markdown",
        status: "completed",
        sourceConversationId: "conv-1",
        createdAt: "2026-02-01T00:00:00.000Z",
        nextMode: "review",
        nextReason: "next",
        evidenceRefs: [],
      },
    ]);
    mockRepo.listTraces.mockResolvedValue([
      baseTrace("trace-memory", "2026-03-18T00:00:00.000Z", 1),
      baseTrace("trace-artifact", "2026-03-17T00:00:00.000Z", null),
      baseTrace("trace-dependency", "2026-03-16T00:00:00.000Z", -1),
    ]);
    mockQueryDebugEvents.mockResolvedValue([
      {
        id: "evt-memory",
        occurredAt: "2026-03-18T00:00:00.000Z",
        ingestedAt: "2026-03-18T00:00:00.000Z",
        level: "info",
        source: "api/chat",
        eventType: "chat.context.loaded",
        message: "memory",
        projectSlug: "alpha",
        traceId: "trace-memory",
        requestId: null,
        sessionId: null,
        conversationId: "conv-trace-memory",
        entityType: "conversation",
        entityId: "conv-trace-memory",
        status: "completed",
        durationMs: null,
        metadata: {
          memory: { count: 1, keys: ["alpha"], query: "" },
          context: { attachedArtifacts: [], dependencyArtifacts: [] },
        },
      },
      {
        id: "evt-artifact",
        occurredAt: "2026-03-17T00:00:00.000Z",
        ingestedAt: "2026-03-17T00:00:00.000Z",
        level: "info",
        source: "api/chat",
        eventType: "chat.context.loaded",
        message: "artifact",
        projectSlug: "alpha",
        traceId: "trace-artifact",
        requestId: null,
        sessionId: null,
        conversationId: "conv-trace-artifact",
        entityType: "conversation",
        entityId: "conv-trace-artifact",
        status: "completed",
        durationMs: null,
        metadata: {
          memory: { count: 0, keys: [], query: "" },
          context: {
            attachedArtifacts: [{ id: "art-1", label: "Plan", kind: "artifact" }],
            dependencyArtifacts: [],
          },
        },
      },
      {
        id: "evt-dependency",
        occurredAt: "2026-03-16T00:00:00.000Z",
        ingestedAt: "2026-03-16T00:00:00.000Z",
        level: "info",
        source: "api/chat",
        eventType: "chat.context.loaded",
        message: "dependency",
        projectSlug: "alpha",
        traceId: "trace-dependency",
        requestId: null,
        sessionId: null,
        conversationId: "conv-trace-dependency",
        entityType: "conversation",
        entityId: "conv-trace-dependency",
        status: "completed",
        durationMs: null,
        metadata: {
          memory: { count: 0, keys: [], query: "" },
          context: {
            attachedArtifacts: [],
            dependencyArtifacts: [{ id: "art-1", label: "Plan", kind: "artifact" }],
          },
        },
      },
    ]);

    const summary = await buildKnowledgeHealthSummary(mockRepo as never);
    expect(summary.summary.totals.knowledgeBackedRunCount).toBe(3);
    expect(summary.summary.nextModeDistribution[0]).toMatchObject({
      nextMode: null,
      count: 3,
    });
  });

  it("marks stale items based on retained history and returns detail payloads for memory and artifact items", async () => {
    mockRepo.listMemory.mockResolvedValue([
      {
        id: "mem-1",
        key: "older",
        value: "old note",
        embedding: null,
        projectSlug: "alpha",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    mockRepo.listArtifacts.mockResolvedValue([
      {
        id: "art-1",
        projectSlug: "alpha",
        mode: "plan",
        title: "Plan",
        summary: "summary",
        body: "body",
        contentType: "markdown",
        status: "completed",
        sourceConversationId: "conv-1",
        createdAt: "2026-01-01T00:00:00.000Z",
        nextMode: "review",
        nextReason: "next",
        evidenceRefs: [{ kind: "repo", label: "repo" }],
      },
    ]);
    mockRepo.listTraces.mockResolvedValue([baseTrace("trace-1", "2026-03-01T00:00:00.000Z", 1)]);
    mockQueryDebugEvents.mockResolvedValue([
      {
        id: "evt-1",
        occurredAt: "2026-03-01T00:00:00.000Z",
        ingestedAt: "2026-03-01T00:00:00.000Z",
        level: "info",
        source: "api/chat",
        eventType: "chat.context.loaded",
        message: "loaded",
        projectSlug: "alpha",
        traceId: "trace-1",
        requestId: null,
        sessionId: null,
        conversationId: "conv-trace-1",
        entityType: "conversation",
        entityId: "conv-trace-1",
        status: "completed",
        durationMs: null,
        metadata: {
          memory: { count: 0, keys: [], query: "note" },
          context: {
            attachedArtifacts: [{ id: "art-1", label: "Plan", kind: "artifact" }],
            dependencyArtifacts: [],
          },
        },
      },
      {
        id: "evt-save",
        occurredAt: "2026-03-01T00:00:01.000Z",
        ingestedAt: "2026-03-01T00:00:01.000Z",
        level: "info",
        source: "api/chat",
        eventType: "chat.artifact.saved",
        message: "saved",
        projectSlug: "alpha",
        traceId: "trace-1",
        requestId: null,
        sessionId: null,
        conversationId: "conv-trace-1",
        entityType: "artifact",
        entityId: "art-1",
        status: "completed",
        durationMs: null,
        metadata: {
          artifact: { id: "art-1", title: "Plan", mode: "plan", status: "completed" },
          recommendation: { nextMode: "review", nextReason: "next" },
        },
      },
    ]);

    const detail = await buildKnowledgeHealthItemDetail(mockRepo as never, "memory:mem-1");
    const artifactDetail = await buildKnowledgeHealthItemDetail(
      mockRepo as never,
      "artifact:art-1"
    );
    const summary = await buildKnowledgeHealthSummary(mockRepo as never);

    expect(summary.summary.topStaleItems[0]).toMatchObject({
      type: "memory",
      stale: true,
    });
    expect(detail).toMatchObject({
      record: expect.objectContaining({ type: "memory", id: "mem-1" }),
      actions: expect.arrayContaining([
        expect.objectContaining({ kind: "delete-memory", route: API_ROUTES.chatMemory }),
      ]),
    });
    expect(artifactDetail).toMatchObject({
      record: expect.objectContaining({ type: "artifact", id: "art-1" }),
      actions: expect.arrayContaining([expect.objectContaining({ kind: "open-artifact" })]),
    });
  });

  it("filters items by project and pagination", async () => {
    mockRepo.listMemory.mockResolvedValue([
      {
        id: "mem-1",
        key: "alpha-note",
        value: "alpha",
        embedding: null,
        projectSlug: "alpha",
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-01T00:00:00.000Z",
      },
      {
        id: "mem-2",
        key: "global-note",
        value: "global",
        embedding: null,
        projectSlug: null,
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-01T00:00:00.000Z",
      },
    ]);
    mockRepo.listTraces.mockResolvedValue([]);
    mockRepo.listArtifacts.mockResolvedValue([]);

    const response = await buildKnowledgeHealthItems(mockRepo as never, {
      project: "alpha",
      page: 1,
      limit: 10,
    });

    expect(response.total).toBe(1);
    expect(response.items).toHaveLength(1);
    expect(response.items[0].projectSlug).toBe("alpha");
  });
});
