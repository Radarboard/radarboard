/* biome-ignore-all lint/style/useNamingConvention: Route handler maps intentionally use HTTP method keys. */
import { API_ROUTES } from "@radarboard/types/api-routes";
import { registerRoutes } from "@/lib/router/registry";
import { handleGetDatabaseConfig, handleSetDatabaseConfig } from "./config";
import { handleRunDatabaseMigrations } from "./migrate";
import { handleTestDatabase } from "./test";
import { handleExportDatabase, handleImportDatabase } from "./transfer";

registerRoutes([
  {
    path: API_ROUTES.databaseConfigLegacy,
    handlers: { GET: handleGetDatabaseConfig, POST: handleSetDatabaseConfig },
  },
  {
    path: API_ROUTES.databaseConfig,
    handlers: { GET: handleGetDatabaseConfig, POST: handleSetDatabaseConfig },
  },
  {
    path: API_ROUTES.databaseTest,
    handlers: { POST: handleTestDatabase },
  },
  {
    path: API_ROUTES.databaseMigrate,
    handlers: { POST: handleRunDatabaseMigrations },
  },
  {
    path: API_ROUTES.databaseExport,
    handlers: { GET: handleExportDatabase },
  },
  {
    path: API_ROUTES.databaseImport,
    handlers: { POST: handleImportDatabase },
  },
]);
