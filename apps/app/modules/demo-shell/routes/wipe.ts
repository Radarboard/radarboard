import { createLogger } from "@radarboard/logger/logger";
import { NextResponse } from "next/server";
import { getCacheRepo, getSettingsRepo } from "@/db/repository";
import { errorJson } from "@/lib/api";

const log = createLogger("api/demo/wipe");

/**
 * POST /api/demo/wipe — clears all cached data and sets demoMode=false.
 */
export async function handleDemoWipe() {
  try {
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
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    log.error("Failed to wipe demo data", { error });
    const message = error instanceof Error ? error.message : "Unknown error";
    return errorJson(500, message, { ok: false });
  }
}
