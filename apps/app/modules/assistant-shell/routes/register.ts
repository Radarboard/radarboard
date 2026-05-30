/* biome-ignore-all lint/style/useNamingConvention: Route handler maps intentionally use HTTP method keys. */
import { API_ROUTE_PATTERNS, API_ROUTES } from "@radarboard/types/api-routes";
import { registerRoutes } from "@/lib/router/registry";
import { handleGetArtifact, handleListArtifacts, handleUpsertArtifact } from "./artifacts";
import { handleGetBriefing } from "./briefing";
import { handleChatRequest } from "./chat";
import {
  handleDeleteConversation,
  handleGetConversationMessages,
  handleUpdateConversationTitle,
} from "./conversations/detail";
import { handleExtractConversationMemories } from "./conversations/extract";
import { handleCreateConversation, handleListConversations } from "./conversations/list";
import { handleSearchConversationMessages } from "./conversations/search";
import { handleEmbeddings } from "./embeddings";
import { handleChatFeedback } from "./feedback";
import { handleGetKnowledgeHealthItemDetail } from "./knowledge-health-item-detail";
import { handleGetKnowledgeHealthItems } from "./knowledge-health-items";
import { handleGetKnowledgeHealthProject } from "./knowledge-health-project";
import { handleGetKnowledgeHealthSummary } from "./knowledge-health-summary";
import { handleCreateMemory, handleDeleteMemory, handleListMemory } from "./memory";
import { handleGetChatModels } from "./models";
import { handleDeletePreset, handleListPresets, handleUpsertPreset } from "./presets";
import { handleGetChatProjects } from "./projects";
import { handleDeleteSkill, handleListSkills, handleUpsertSkill } from "./skills";
import { handleImportSkill } from "./skills-import";
import { handleCreateWorkflow, handleDeleteWorkflow, handleListWorkflows } from "./workflows";

type ParamsContext<T extends Record<string, string>> = { params: Promise<T> };

registerRoutes([
  // --- Chat ---
  {
    path: API_ROUTES.chat,
    handlers: { POST: handleChatRequest },
  },
  // --- Artifacts ---
  {
    path: API_ROUTES.chatArtifacts,
    handlers: { GET: handleListArtifacts, POST: handleUpsertArtifact },
  },
  {
    path: API_ROUTE_PATTERNS.chatArtifactDetail,
    handlers: {
      GET: async (_request: Request, context?: unknown) => {
        const { id } = await (context as ParamsContext<{ id: string }>).params;
        return handleGetArtifact(id);
      },
    },
  },
  // --- Presets ---
  {
    path: API_ROUTES.chatPresets,
    handlers: { GET: handleListPresets, POST: handleUpsertPreset, DELETE: handleDeletePreset },
  },
  // --- Skills ---
  {
    path: API_ROUTES.chatSkills,
    handlers: { GET: handleListSkills, POST: handleUpsertSkill, DELETE: handleDeleteSkill },
  },
  {
    path: API_ROUTES.chatSkillsImport,
    handlers: { POST: handleImportSkill },
  },
  // --- Memory ---
  {
    path: API_ROUTES.chatMemory,
    handlers: { GET: handleListMemory, POST: handleCreateMemory, DELETE: handleDeleteMemory },
  },
  // --- Conversations ---
  {
    path: API_ROUTES.chatConversations,
    handlers: { GET: handleListConversations, POST: handleCreateConversation },
  },
  {
    path: API_ROUTE_PATTERNS.chatConversationDetail,
    handlers: {
      GET: async (_request: Request, context?: unknown) => {
        const { id } = await (context as ParamsContext<{ id: string }>).params;
        return handleGetConversationMessages(id);
      },
      PATCH: async (request: Request, context?: unknown) => {
        const { id } = await (context as ParamsContext<{ id: string }>).params;
        return handleUpdateConversationTitle(request, id);
      },
      DELETE: async (_request: Request, context?: unknown) => {
        const { id } = await (context as ParamsContext<{ id: string }>).params;
        return handleDeleteConversation(id);
      },
    },
  },
  {
    path: API_ROUTE_PATTERNS.chatConversationExtract,
    handlers: {
      POST: async (_request: Request, context?: unknown) => {
        const { id } = await (context as ParamsContext<{ id: string }>).params;
        return handleExtractConversationMemories(id);
      },
    },
  },
  {
    path: API_ROUTES.chatConversationSearch,
    handlers: { GET: handleSearchConversationMessages },
  },
  // --- Feedback ---
  {
    path: API_ROUTES.chatFeedback,
    handlers: { POST: handleChatFeedback },
  },
  // --- Projects ---
  {
    path: API_ROUTES.chatProjects,
    handlers: { GET: handleGetChatProjects },
  },
  // --- Models ---
  {
    path: API_ROUTES.chatModels,
    handlers: { GET: handleGetChatModels },
  },
  // --- Embeddings ---
  {
    path: API_ROUTES.embeddings,
    handlers: { POST: handleEmbeddings },
  },
  // --- Briefing ---
  {
    path: API_ROUTES.briefing,
    handlers: { GET: handleGetBriefing },
  },
  // --- Workflows ---
  {
    path: API_ROUTES.workflows,
    handlers: {
      GET: handleListWorkflows,
      POST: handleCreateWorkflow,
      DELETE: handleDeleteWorkflow,
    },
  },
  // --- Knowledge Health ---
  {
    path: API_ROUTES.knowledgeHealthSummary,
    handlers: { GET: handleGetKnowledgeHealthSummary },
  },
  {
    path: API_ROUTES.knowledgeHealthItems,
    handlers: { GET: handleGetKnowledgeHealthItems },
  },
  {
    path: API_ROUTE_PATTERNS.knowledgeHealthItem,
    handlers: {
      GET: async (_request: Request, context?: unknown) => {
        const { id } = await (context as ParamsContext<{ id: string }>).params;
        return handleGetKnowledgeHealthItemDetail(id);
      },
    },
  },
  {
    path: API_ROUTE_PATTERNS.knowledgeHealthProject,
    handlers: {
      GET: async (_request: Request, context?: unknown) => {
        const { slug } = await (context as ParamsContext<{ slug: string }>).params;
        return handleGetKnowledgeHealthProject(slug);
      },
    },
  },
]);
