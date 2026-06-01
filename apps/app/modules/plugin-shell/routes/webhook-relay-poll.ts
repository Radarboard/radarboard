import { withLogging } from "@radarboard/logger/middleware";
import { API_ROUTES } from "@radarboard/types/api-routes";
import { errorJson } from "@/lib/api";

export const handleWebhookRelayPoll = withLogging(API_ROUTES.relayPoll, async () =>
  errorJson(404, "Webhook relay plugin is not installed")
);
