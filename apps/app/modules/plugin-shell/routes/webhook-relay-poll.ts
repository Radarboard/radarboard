import { createLogger } from "@radarboard/logger/logger";
import { withLogging } from "@radarboard/logger/middleware";
import { pollWebhookRelay } from "@radarboard/plugin-webhook-relay/server/poll-relay";
import { API_ROUTES } from "@radarboard/types/api-routes";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSettingsRepo } from "@/data/core/repository";
import { errorJson, parseBody } from "@/lib/api";
import { emitDebugEvent } from "@/lib/debug-events";
import { getWebEnv, WEB_ENV_KEYS } from "@/lib/env";
import { persistIntegrationArtifacts } from "@/lib/integration-artifacts";
import { emitNotificationEvents } from "@/lib/notifications";

const log = createLogger("api/relay/poll");

const PollSchema = z.object({
  since: z.number().int().nonnegative(),
});

export const handleWebhookRelayPoll = withLogging(
  API_ROUTES.relayPoll,
  async (request: Request) => {
    const parsed = await parseBody(request, PollSchema);
    if (!parsed.ok) return parsed.response;

    try {
      const result = await pollWebhookRelay(parsed.data.since, {
        async getRelayUrl() {
          try {
            const repo = getSettingsRepo();
            const integrations = await repo.getProjectIntegrations();
            const relayConfig = integrations["@@system"]?.relay;
            const url = relayConfig?.url;
            return typeof url === "string" && url.length > 0 ? url : undefined;
          } catch {
            return undefined;
          }
        },
        getRelaySecret() {
          return getWebEnv(WEB_ENV_KEYS.relay.secret);
        },
        persistIntegrationArtifacts,
        emitNotificationEvents,
        emitDebugEvent,
      });
      if (!result) {
        return NextResponse.json({ configured: false });
      }

      return NextResponse.json({
        configured: true,
        eventCount: result.eventCount,
        relayTimestamp: result.relayTimestamp,
      });
    } catch (error) {
      log.error("Relay poll failed", { error });
      return errorJson(500, "Relay poll failed");
    }
  }
);
