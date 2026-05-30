import { createLogger } from "@radarboard/logger/logger";
import { NextResponse } from "next/server";
import { z } from "zod";
import { errorJson, parseBody } from "@/lib/api";
import { signPluginToken } from "@/lib/plugin-token";

const log = createLogger("api/plugins/token");

const TokenRequestSchema = z.object({
  pluginId: z.string().min(1),
});

/** POST /api/plugins/token — issue a signed token scoped to a pluginId. */
export async function handleIssuePluginToken(request: Request) {
  const parsed = await parseBody(request, TokenRequestSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const token = signPluginToken(parsed.data.pluginId);
    return NextResponse.json({ token });
  } catch (err) {
    log.error("Token signing failed", { error: String(err) });
    return errorJson(500, "Failed to issue plugin token");
  }
}
