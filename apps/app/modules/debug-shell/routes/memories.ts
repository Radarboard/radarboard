import { createLogger } from "@radarboard/logger/logger";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getLlmRepo } from "@/db/repository";
import { errorJson, parseBody } from "@/lib/api";

const log = createLogger("api/debug/memories");

const debugMemoryDeleteSchema = z.object({
  id: z.string().min(1),
});

export async function handleListDebugMemories() {
  try {
    const repo = getLlmRepo();
    const memories = await repo.listMemory();
    return NextResponse.json({ memories });
  } catch (err) {
    log.error("Failed to list debug memories", { error: err });
    return errorJson(500, err instanceof Error ? err.message : String(err));
  }
}

export async function handleDeleteDebugMemory(request: Request) {
  try {
    const parsed = await parseBody(request, debugMemoryDeleteSchema);
    if (!parsed.ok) return parsed.response;
    const repo = getLlmRepo();
    await repo.deleteMemory(parsed.data.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error("Failed to delete debug memory", { error: err });
    return errorJson(500, err instanceof Error ? err.message : String(err));
  }
}
