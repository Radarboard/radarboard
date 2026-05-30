/* biome-ignore-all lint/style/useNamingConvention: Route handler maps intentionally use HTTP method keys. */
import { API_ROUTES } from "@radarboard/types/api-routes";
import { registerRoutes } from "@/lib/router/registry";
import { handleBillingPortal } from "./billing";
import { handleConfigExport } from "./config-export";
import { handleConfigImport } from "./config-import";
import {
  handleDeleteIntegrationConnection,
  handleGetIntegrationConnections,
  handleUpsertIntegrationConnection,
} from "./integration-connections";
import { handleActivateLicense, handleGetLicense, handleRemoveLicense } from "./license";
import { handleIssueLicense } from "./license-admin";
import { handleGetSettings, handleUpdateSettings } from "./routes";

registerRoutes([
  {
    path: API_ROUTES.settings,
    handlers: { GET: handleGetSettings, POST: handleUpdateSettings },
  },
  {
    path: API_ROUTES.license,
    handlers: { GET: handleGetLicense, POST: handleActivateLicense, DELETE: handleRemoveLicense },
  },
  {
    path: API_ROUTES.licenseAdmin,
    handlers: { POST: handleIssueLicense },
  },
  {
    path: API_ROUTES.billingPortal,
    handlers: { GET: handleBillingPortal },
  },
  {
    path: API_ROUTES.configExport,
    handlers: { GET: handleConfigExport },
  },
  {
    path: API_ROUTES.configImport,
    handlers: { POST: handleConfigImport },
  },
  {
    path: API_ROUTES.integrationConnections,
    handlers: {
      GET: handleGetIntegrationConnections,
      POST: handleUpsertIntegrationConnection,
      DELETE: handleDeleteIntegrationConnection,
    },
  },
]);
