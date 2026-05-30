/* biome-ignore-all lint/style/useNamingConvention: Route handler maps intentionally use HTTP method keys. */
import { API_ROUTES } from "@radarboard/types/api-routes";
import { registerRoutes } from "@/lib/router/registry";
import {
  handleDeleteCredentials,
  handleGetCredentials,
  handleSaveCredentials,
} from "./credentials";
import { handleOnePasswordCredentials } from "./one-password";
import { handleTestCredentials } from "./test";

registerRoutes([
  {
    path: API_ROUTES.credentials,
    handlers: {
      GET: handleGetCredentials,
      POST: handleSaveCredentials,
      DELETE: handleDeleteCredentials,
    },
  },
  {
    path: API_ROUTES.credentialsTest,
    handlers: { POST: handleTestCredentials },
  },
  {
    path: API_ROUTES.credentials1password,
    handlers: { POST: handleOnePasswordCredentials },
  },
]);
