/* biome-ignore-all lint/style/useNamingConvention: Route handler maps intentionally use HTTP method keys. */
import { API_ROUTES } from "@radarboard/types/api-routes";
import { registerRoutes } from "@/lib/router/registry";
import { handleDemoSeed } from "./seed";
import { handleDemoWipe } from "./wipe";

registerRoutes([
  {
    path: API_ROUTES.demoSeed,
    handlers: { POST: handleDemoSeed },
  },
  {
    path: API_ROUTES.demoWipe,
    handlers: { POST: handleDemoWipe },
  },
]);
