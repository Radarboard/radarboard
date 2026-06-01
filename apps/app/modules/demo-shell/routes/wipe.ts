import { createLogger } from "@radarboard/logger/logger";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCacheRepo, getSettingsRepo } from "@/db/repository";
import { errorJson, parseBody } from "@/lib/api";

const log = createLogger("api/demo/wipe");
const demoWipeSchema = z.object({
  mode: z.enum(["connect", "fresh"]).optional(),
});

/**
 * POST /api/demo/wipe — clears cached data and sets demoMode=false.
 */
export async function handleDemoWipe(request?: Request) {
  try {
    let mode: "connect" | "fresh" = "connect";
    if (request) {
      const parsed = await parseBody(request, demoWipeSchema);
      if (!parsed.ok) return parsed.response;
      mode = parsed.data.mode ?? "connect";
    }

    const cache = getCacheRepo();
    const settings = getSettingsRepo();

    await cache.clear();

    const currentLayout = await settings.getWidgetLayout();
    if (currentLayout) {
      await settings.setWidgetLayout({
        ...currentLayout,
        preferences: {
          ...currentLayout.preferences,
          demoMode: false,
          ...(mode === "fresh"
            ? {
                onboardingCompleted: false,
                userProfile: null,
                intendedIntegrations: [],
                blueprintWidgetMap: {},
              }
            : {}),
        },
      });
    }

    return NextResponse.json({ ok: true, mode });
  } catch (error) {
    log.error("Failed to wipe demo data", { error });
    const message = error instanceof Error ? error.message : "Unknown error";
    return errorJson(500, message, { ok: false });
  }
}
