/**
 * Core LLM abstraction types.
 *
 * These types are SDK-agnostic — they define the contract
 * that any adapter (Vercel AI SDK, TanStack AI, etc.) must implement.
 * `apps/app` imports from here, never from `ai` or `@tanstack/ai` directly.
 */

import type { AssistantHandoffItem } from "@radarboard/types/assistant";

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export type LlmRole = "user" | "assistant" | "system" | "tool";

export interface LlmTextPart {
  type: "text";
  text: string;
}

export interface LlmToolCallPart {
  type: "tool-call";
  toolCallId: string;
  toolName: string;
  input: unknown;
}

export interface LlmToolResultPart {
  type: "tool-result";
  toolCallId: string;
  toolName: string;
  output: unknown;
  isError?: boolean;
}

export interface LlmImagePart {
  type: "image";
  /** Base-64 encoded image data URI, e.g. "data:image/png;base64,..." */
  image: string;
  mimeType: string;
}

export interface LlmRuntimeContextPart {
  type: "runtime-context";
  item: AssistantHandoffItem;
}

export interface LlmReasoningPart {
  type: "reasoning";
  text: string;
}

export type LlmMessagePart =
  | LlmTextPart
  | LlmToolCallPart
  | LlmToolResultPart
  | LlmImagePart
  | LlmRuntimeContextPart
  | LlmReasoningPart;

export interface LlmMessage {
  id: string;
  role: LlmRole;
  parts: LlmMessagePart[];
  createdAt: Date;
  /** Model used to generate this message (only present on streamed assistant messages). */
  model?: string;
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

export interface LlmToolDefinition {
  description: string;
  parameters: Record<string, unknown>;
  execute: (input: unknown) => Promise<unknown>;
}

export type LlmToolSet = Record<string, LlmToolDefinition>;

// ---------------------------------------------------------------------------
// Provider descriptors (SDK-agnostic metadata)
// ---------------------------------------------------------------------------

export type LlmAuthType = "api_key" | "oauth" | "none";

export interface LlmModelOption {
  id: string;
  name: string;
  contextWindow: number;
  supportsTools: boolean;
  supportsStreaming: boolean;
}

export interface LlmProviderDescriptor {
  id: string;
  name: string;
  auth: LlmAuthType;
  models: LlmModelOption[];
  defaultModel: string;
  /** Credential fields rendered in the settings form. */
  credentialFields: LlmCredentialField[];
  /** Prefix used in the credential store (e.g. "llm::anthropic"). */
  credentialKeyPrefix: string;
}

export interface LlmCredentialField {
  key: string;
  label: string;
  type: "text" | "password";
  placeholder: string;
  required: boolean;
}

// ---------------------------------------------------------------------------
// Adapter interface — the ONE contract adapters must implement
// ---------------------------------------------------------------------------

export interface StreamChatParams {
  providerId: string;
  apiKey: string;
  model: string;
  messages: LlmMessage[];
  systemPrompt: string;
  tools?: LlmToolSet;
  /** Pass-through for native SDK tool objects (e.g. AI SDK tool() results). */
  nativeTools?: Record<string, unknown>;
  onFinish?: (result: StreamChatResult) => Promise<void>;
}

export interface StreamChatResult {
  /** The full assistant message text. */
  text: string;
  /** Token usage stats, when available. */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface GenerateTextParams {
  providerId: string;
  apiKey: string;
  model: string;
  messages: LlmMessage[];
  systemPrompt: string;
}

export interface GenerateTextResult {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/** Well-known embedding model identifiers (extensible with any string for Ollama etc.). */
export type EmbeddingModelId =
  // OpenAI
  | "text-embedding-3-small"
  | "text-embedding-3-large"
  // Google
  | "text-embedding-004"
  // Ollama (local)
  | "nomic-embed-text"
  | "nomic-embed-text:v2-moe"
  | "mxbai-embed-large"
  | "snowflake-arctic-embed"
  | "snowflake-arctic-embed2"
  | "bge-m3"
  | "bge-large"
  | "all-minilm"
  // Allow any string for custom/new models
  | (string & {});

export interface EmbedParams {
  providerId: string;
  apiKey: string;
  texts: string[];
  /** Override the default embedding model. Defaults to text-embedding-3-small for OpenAI/Anthropic. */
  modelId?: EmbeddingModelId;
  /** Override output dimensions (only supported by OpenAI models). */
  dimensions?: number;
}

export interface EmbedResult {
  embeddings: number[][];
  usage?: { totalTokens: number };
}

export interface LlmAdapter {
  /** Stream a chat completion. Returns a standard Response (SSE or similar). */
  streamChat(params: StreamChatParams): Promise<Response>;

  /** Generate a single non-streamed completion. */
  generateText(params: GenerateTextParams): Promise<GenerateTextResult>;

  /** Generate embeddings for text. */
  embed(params: EmbedParams): Promise<EmbedResult>;
}

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

export interface LlmSkillDescriptor {
  id: string;
  name: string;
  description: string;
  /** The instruction text injected into the system prompt. */
  instructions: string;
  /** Whether this skill is bundled (built-in) vs user-created. */
  builtin: boolean;
}

// ---------------------------------------------------------------------------
// Conversations & Memory (DB shapes)
// ---------------------------------------------------------------------------

export interface LlmConversation {
  id: string;
  title: string;
  projectSlug: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LlmStoredMessage {
  id: string;
  conversationId: string;
  role: LlmRole;
  parts: LlmMessagePart[];
  createdAt: Date;
}

export interface LlmMemoryEntry {
  id: string;
  key: string;
  value: string;
  embedding: number[] | null;
  projectSlug: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Client hook interface — adapter packages must export a useLlmChat matching this
// ---------------------------------------------------------------------------

export type LlmChatStatus = "ready" | "streaming" | "submitted" | "error";

export interface UseLlmChatReturn {
  messages: LlmMessage[];
  sendMessage: (text: string) => void;
  status: LlmChatStatus;
  stop: () => void;
  regenerate: () => void;
  error: Error | null;
}
