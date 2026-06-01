import { createLogger } from "@radarboard/logger/logger";
import { NextResponse } from "next/server";
import { z } from "zod";
import { errorJson, parseBody } from "@/lib/api";
import { getPluginServerRoute } from "@/lib/extensions/runtime/server/plugin-server";

const log = createLogger("api/embeddings");
const embeddingsBodySchema = z.record(z.string(), z.unknown());

export async function handleEmbeddings(request: Request) {
  try {
    const parsed = await parseBody(request, embeddingsBodySchema);
    if (!parsed.ok) return parsed.response;
    const route = getPluginServerRoute("embeddings", "embeddings");
    if (!route) {
      return errorJson(404, "Embeddings plugin route is not registered");
    }

    const result = await route({
      request,
      body: parsed.data,
    });
    return NextResponse.json(result.payload, { status: result.status });
  } catch (error) {
    log.error("Embeddings API error", { error });
    const message = error instanceof Error ? error.message : "Unknown error";
    return errorJson(500, message);
  }
}
