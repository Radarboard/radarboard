/* biome-ignore-all lint/style/useNamingConvention: Route handler maps intentionally use HTTP method keys. */
import { API_ROUTES } from "@radarboard/types/api-routes";
import { registerRoutes } from "@/lib/router/registry";
import { handleMcpServer } from "./server";
import { handleDeleteMcpServer, handleListMcpServers, handleSaveMcpServer } from "./servers";
import { handleTestMcpServer } from "./test";

registerRoutes([
  {
    path: API_ROUTES.mcp,
    handlers: { GET: handleMcpServer, POST: handleMcpServer, DELETE: handleMcpServer },
  },
  {
    path: API_ROUTES.mcpServers,
    handlers: {
      GET: handleListMcpServers,
      POST: handleSaveMcpServer,
      DELETE: handleDeleteMcpServer,
    },
  },
  {
    path: API_ROUTES.mcpServersTest,
    handlers: { POST: handleTestMcpServer },
  },
]);
