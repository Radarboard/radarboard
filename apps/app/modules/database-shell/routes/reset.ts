import { createLogger } from "@radarboard/logger/logger";
import { NextResponse } from "next/server";
import { z } from "zod";
import { errorJson, parseBody } from "@/lib/api";
import { performFactoryReset } from "@/lib/system/factory-reset";

const log = createLogger("api/system/reset");

const resetSchema = z.object({
  /** Explicit confirmation guard so this destructive action can't fire accidentally. */
  confirm: z.literal("ERASE"),
});

/**
 * POST /api/system/reset — full factory reset.
 *
 * Erases ALL user data (credentials, integrations, cache, layouts, plugin data,
 * LLM history, notifications, debug events, settings) and returns the app to
 * first-run state. Requires `{ confirm: "ERASE" }` in the body.
 */
export async function handleFactoryReset(request: Request) {
  const parsed = await parseBody(request, resetSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const result = await performFactoryReset();
    // A partial wipe is NOT a success — surface it as an error so the client
    // shows what failed instead of silently reloading into a half-erased state.
    if (result.errors.length > 0) {
      log.error("Factory reset completed with errors", {
        cleared: result.cleared,
        errors: result.errors,
      });
      return errorJson(500, `Some data couldn't be erased: ${result.errors.join("; ")}`, {
        ok: false,
        cleared: result.cleared,
        errors: result.errors,
      });
    }
    log.info("Factory reset completed", { cleared: result.cleared, errors: result.errors });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    log.error("Factory reset failed", { error });
    return errorJson(500, message, { ok: false });
  }
}
