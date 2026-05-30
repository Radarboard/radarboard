import { createLogger } from "@radarboard/logger/logger";
import { withLogging } from "@radarboard/logger/middleware";
import { checkProjectHealth } from "@radarboard/plugin-status-page/project-health";
import { API_ROUTES } from "@radarboard/types/api-routes";
import { NextResponse } from "next/server";
import { z } from "zod";
import { PROJECTS } from "@/config/projects";
import { errorJson } from "@/lib/api";

const log = createLogger("api/status-page/project-health");

const QuerySchema = z.object({
  projectSlug: z.string().min(1),
  platformId: z.string().min(1),
});

export const handleGetStatusPageHealth = withLogging(
  API_ROUTES.statusPageProjectHealth,
  async (request: Request) => {
    const url = new URL(request.url);
    const parsed = QuerySchema.safeParse({
      projectSlug: url.searchParams.get("projectSlug"),
      platformId: url.searchParams.get("platformId"),
    });

    if (!parsed.success) {
      return errorJson(400, "Invalid project health query");
    }

    const result = await checkProjectHealth(
      PROJECTS,
      parsed.data.projectSlug,
      parsed.data.platformId
    );
    if (!result) {
      return errorJson(404, "Health check not found");
    }

    if (result.error) {
      log.error("Health check request failed", { error: result.error });
    }

    return NextResponse.json(result, { status: 200 });
  }
);
