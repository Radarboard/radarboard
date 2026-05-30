import { createLogger } from "@radarboard/logger/logger";
import {
  type EmbeddingsRouteBody,
  handleEmbeddingsRoute,
} from "@radarboard/plugin-embeddings/server/routes";
import { NextResponse } from "next/server";
import { z } from "zod";
import { errorJson, parseBody } from "@/lib/api";
import { getEmbeddingService } from "@/lib/embedding-service-singleton";

const log = createLogger("api/embeddings");
const embeddingsBodySchema = z.record(z.string(), z.unknown());

export async function handleEmbeddings(request: Request) {
  try {
    const parsed = await parseBody(request, embeddingsBodySchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data as unknown as EmbeddingsRouteBody;
    const { action, modelId, providerId, dimensions } = body;

    const service = await getEmbeddingService({
      modelId,
      providerId,
      dimensions: dimensions && dimensions > 0 ? dimensions : undefined,
    });
    if (!service) {
      return errorJson(503, "Embedding service unavailable — no LLM provider configured");
    }
    const result = await handleEmbeddingsRoute(service, { ...body, action });
    return NextResponse.json(result.payload, { status: result.status });
  } catch (error) {
    log.error("Embeddings API error", { error });
    const message = error instanceof Error ? error.message : "Unknown error";
    return errorJson(500, message);
  }
}
