/* biome-ignore-all lint/style/useNamingConvention: Route handler maps intentionally use HTTP method keys. */
import { API_ROUTES } from "@radarboard/types/api-routes";
import { registerRoutes } from "@/lib/router/registry";
import { handleRunBackup } from "./backup";
import { handleBackupExport } from "./export";
import { handleGetBackupManifest } from "./manifest";

registerRoutes([
  {
    path: API_ROUTES.backup,
    handlers: { POST: handleRunBackup },
  },
  {
    path: API_ROUTES.backupExport,
    handlers: { GET: handleBackupExport },
  },
  {
    path: API_ROUTES.backupManifest,
    handlers: { GET: handleGetBackupManifest },
  },
]);
