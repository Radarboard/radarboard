/* biome-ignore-all lint/style/useNamingConvention: Route handler maps intentionally use HTTP method keys. */
import { API_ROUTE_PATTERNS, API_ROUTES } from "@radarboard/types/api-routes";
import { registerRoutes } from "@/lib/router/registry";
import { handleListDebugCacheEntries } from "./cache";
import { handleE2EState } from "./e2e-state";
import { handleCreateDebugEvent, handleListDebugEvents } from "./events";
import { handleEventsStream } from "./events-stream";
import { handleHealthIntegrations } from "./health-integrations";
import { handleClearLogs, handleGetLogs } from "./logs";
import { handleLogsStream } from "./logs-stream";
import { handleDeleteDebugMemory, handleListDebugMemories } from "./memories";
import { handleGetReportDetail } from "./report-detail";
import { handleListDebugReports } from "./reports";
import { handleListDebugSpans } from "./spans";
import { handleDebugEventsTimeline } from "./timeline";
import { handleListDebugTraces, handleUpdateTraceRating } from "./traces";

type ParamsContext<T extends Record<string, string>> = { params: Promise<T> };

registerRoutes([
  {
    path: API_ROUTES.debugEvents,
    handlers: { GET: handleListDebugEvents, POST: handleCreateDebugEvent },
  },
  {
    path: API_ROUTES.debugEventsTimeline,
    handlers: { GET: handleDebugEventsTimeline },
  },
  {
    path: API_ROUTES.debugTraces,
    handlers: { GET: handleListDebugTraces, PATCH: handleUpdateTraceRating },
  },
  {
    path: API_ROUTES.debugMemories,
    handlers: { GET: handleListDebugMemories, DELETE: handleDeleteDebugMemory },
  },
  {
    path: API_ROUTES.debugCache,
    handlers: { GET: handleListDebugCacheEntries },
  },
  {
    path: API_ROUTES.debugSpans,
    handlers: { GET: handleListDebugSpans },
  },
  {
    path: API_ROUTES.debugReports,
    handlers: { GET: handleListDebugReports },
  },
  {
    path: API_ROUTES.eventsStream,
    handlers: { GET: handleEventsStream },
  },
  {
    path: API_ROUTES.logs,
    handlers: { GET: handleGetLogs, DELETE: handleClearLogs },
  },
  {
    path: API_ROUTES.logsStream,
    handlers: { GET: handleLogsStream },
  },
  {
    path: API_ROUTES.healthIntegrations,
    handlers: { GET: handleHealthIntegrations },
  },
  {
    path: API_ROUTE_PATTERNS.devReport,
    handlers: {
      GET: async (_request: Request, context?: unknown) => {
        const { id } = await (context as ParamsContext<{ id: string }>).params;
        return handleGetReportDetail(id);
      },
    },
  },
  {
    path: API_ROUTES.e2eState,
    handlers: { POST: handleE2EState },
  },
]);
