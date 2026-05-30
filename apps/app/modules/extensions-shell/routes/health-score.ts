import { getAllIntegrations } from "@radarboard/integration-sdk/registry";
import { checkDependenciesWithCredentials } from "@radarboard/integration-sdk/resolver";
import { createLogger } from "@radarboard/logger/logger";
import { NextResponse } from "next/server";
import { getCredentialRepo } from "@/db/repository";
import { errorJson } from "@/lib/api";

const log = createLogger("api/extensions/health-score");

interface HealthScore {
  overall: number;
  coverage: { score: number; configured: number; total: number };
  details: Array<{
    integrationId: string;
    name: string;
    configured: boolean;
  }>;
}

export async function handleGetExtensionHealthScore() {
  try {
    const integrations = getAllIntegrations();
    const credRepo = getCredentialRepo();

    const resolveCredential = async (key: string) => {
      try {
        return await credRepo.getCredential(key);
      } catch {
        return null;
      }
    };

    const integrationIds = integrations.map((i) => i.id);
    const statuses = await checkDependenciesWithCredentials(integrationIds, resolveCredential);

    const configured = statuses.filter((s) => s.configured).length;
    const total = statuses.length;
    const coverageScore = total > 0 ? Math.round((configured / total) * 100) : 0;

    const details = integrations.map((i) => {
      const status = statuses.find((s) => s.integrationId === i.id);
      return {
        integrationId: i.id,
        name: i.name,
        configured: status?.configured ?? false,
      };
    });

    const result: HealthScore = {
      overall: coverageScore,
      coverage: { score: coverageScore, configured, total },
      details,
    };

    return NextResponse.json(result);
  } catch (err) {
    log.error("Failed to compute health score", { error: err });
    return errorJson(500, err instanceof Error ? err.message : "Failed to compute health score");
  }
}
