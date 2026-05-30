export interface AssistantHandoffItem {
  id: string;
  kind: string;
  title: string;
  summary: string;
  bodyMarkdown: string;
  badge?: string;
  sourceUrl?: string;
  projectSlug?: string | null;
  metadata: Record<string, unknown>;
}

export type KnowledgeHealthItemType = "memory" | "artifact";
export type KnowledgeHealthAttributionQuality = "explicit" | "inferred";
export type KnowledgeHealthTraceRelation = "memory" | "artifact" | "dependency" | "saved";
export type KnowledgeHealthArtifactRelation = "attachment" | "dependency" | "saved";

export interface KnowledgeHealthItem {
  id: string;
  sourceId: string;
  type: KnowledgeHealthItemType;
  projectSlug: string | null;
  title: string;
  summary: string | null;
  createdAt: string;
  updatedAt: string | null;
  lastUsedAt: string | null;
  useCount: number | null;
  positiveFeedbackCount: number | null;
  negativeFeedbackCount: number | null;
  artifactInfluenceCount: number | null;
  recommendationInfluenceCount: number | null;
  evidenceRefCount: number;
  stale: boolean;
  attributionQuality: KnowledgeHealthAttributionQuality;
}

export interface KnowledgeHealthMemoryRecord {
  type: "memory";
  id: string;
  key: string;
  value: string;
  projectSlug: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeHealthArtifactRecord {
  type: "artifact";
  id: string;
  projectSlug: string | null;
  mode: string;
  title: string;
  summary: string;
  body: string;
  contentType: string;
  status: string;
  sourceConversationId: string | null;
  createdAt: string;
  nextMode: string | null;
  nextReason: string | null;
  evidenceRefs: Array<{
    kind: string;
    label: string;
    url?: string;
  }>;
}

export interface KnowledgeHealthTraceLink {
  id: string;
  projectSlug: string | null;
  conversationId: string | null;
  createdAt: string;
  rating: number | null;
  knowledgeBacked: boolean;
  nextMode: string | null;
  evidenceRefCount: number;
  relations: KnowledgeHealthTraceRelation[];
}

export interface KnowledgeHealthLinkedArtifact {
  id: string;
  projectSlug: string | null;
  title: string;
  summary: string;
  createdAt: string;
  nextMode: string | null;
  nextReason: string | null;
  evidenceRefCount: number;
  relations: KnowledgeHealthArtifactRelation[];
}

export interface KnowledgeHealthAction {
  kind: "delete-memory" | "open-artifact" | "open-trace-events";
  label: string;
  method: "GET" | "DELETE";
  route: string;
  targetId: string;
}

export interface KnowledgeHealthFeedbackSummary {
  positive: number;
  negative: number;
}

export interface KnowledgeHealthRunFeedbackSummary {
  total: KnowledgeHealthFeedbackSummary;
  knowledgeBacked: KnowledgeHealthFeedbackSummary;
  nonKnowledgeBacked: KnowledgeHealthFeedbackSummary;
}

export interface KnowledgeHealthNextModeCount {
  nextMode: string | null;
  count: number;
  knowledgeBackedCount: number;
}

export interface KnowledgeHealthProjectSummary {
  projectSlug: string | null;
  projectName: string;
  itemCount: number;
  memoryCount: number;
  artifactCount: number;
  runCount: number;
  knowledgeBackedRunCount: number;
  recentlyUsedCount: number;
  staleCount: number;
  feedback: KnowledgeHealthRunFeedbackSummary;
  nextModeDistribution: KnowledgeHealthNextModeCount[];
  topReusedItems: KnowledgeHealthItem[];
  topStaleItems: KnowledgeHealthItem[];
  retentionNote: string;
}

export interface KnowledgeHealthSummary {
  window: {
    startAt: string | null;
    endAt: string | null;
    basedOnRetainedHistory: boolean;
    retainedDays: number;
  };
  totals: {
    memoryCount: number;
    artifactCount: number;
    itemCount: number;
    runCount: number;
    knowledgeBackedRunCount: number;
    recentlyUsedCount: number;
    staleCount: number;
  };
  feedback: KnowledgeHealthRunFeedbackSummary;
  nextModeDistribution: KnowledgeHealthNextModeCount[];
  topReusedItems: KnowledgeHealthItem[];
  topStaleItems: KnowledgeHealthItem[];
  projects: KnowledgeHealthProjectSummary[];
  retentionNote: string;
}

export interface KnowledgeHealthItemsResponse {
  items: KnowledgeHealthItem[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
  filters: {
    project: string | null;
    type: KnowledgeHealthItemType | "all";
    stale: boolean | "all";
    feedback: "all" | "positive" | "negative" | "mixed" | "any";
    evidence: "all" | "present" | "none";
    query: string | null;
  };
}

export interface KnowledgeHealthItemDetail {
  item: KnowledgeHealthItem;
  record: KnowledgeHealthMemoryRecord | KnowledgeHealthArtifactRecord;
  attributionNotes: string[];
  linkedTraces: KnowledgeHealthTraceLink[];
  linkedArtifacts: KnowledgeHealthLinkedArtifact[];
  linkedEvidenceRefs: Array<{
    kind: string;
    label: string;
    url?: string;
  }>;
  feedback: KnowledgeHealthFeedbackSummary;
  actions: KnowledgeHealthAction[];
}

export interface KnowledgeHealthSummaryResponse {
  summary: KnowledgeHealthSummary;
}

export interface KnowledgeHealthItemDetailResponse {
  item: KnowledgeHealthItemDetail;
}

export interface KnowledgeHealthProjectResponse {
  project: KnowledgeHealthProjectSummary;
}
