import { beforeEach, describe, expect, it, vi } from "vitest";
import { INTEGRATION_REGISTRY, registerIntegration } from "./registry";
import {
  checkDependencies,
  checkDependenciesWithCredentials,
  getMissingDependencies,
} from "./resolver";
import type { IntegrationDescriptor } from "./types";

function buildDescriptor(overrides: Partial<IntegrationDescriptor> = {}): IntegrationDescriptor {
  return {
    id: "linear",
    name: "Linear",
    description: "Linear integration for issues and cycles.",
    icon: () => null,
    category: "communication",
    auth: {
      id: "linear-api",
      name: "Linear",
      type: "api_key",
      fields: [{ key: "apiKey", label: "API Key", type: "password" }],
    },
    ...overrides,
  };
}

describe("integration dependency resolver", () => {
  beforeEach(() => {
    INTEGRATION_REGISTRY.clear();
  });

  it("reports installed and missing dependencies from the registry", () => {
    registerIntegration(buildDescriptor());

    expect(checkDependencies(["linear", "github"])).toEqual([
      { integrationId: "linear", installed: true, configured: false },
      { integrationId: "github", installed: false, configured: false },
    ]);
    expect(getMissingDependencies(["linear", "github"])).toEqual([
      { integrationId: "github", installed: false, configured: false },
    ]);
  });

  it("treats auth:none integrations as configured and resolves credentials by auth id", async () => {
    registerIntegration(
      buildDescriptor({
        id: "statuspage",
        auth: { id: "statuspage", name: "Statuspage", type: "none" },
      })
    );
    registerIntegration(buildDescriptor());

    const resolveCredential = vi.fn(async (key: string) => {
      if (key === "linear-api") {
        return { apiKey: "secret" };
      }
      return null;
    });

    const result = await checkDependenciesWithCredentials(
      ["statuspage", "linear", "github"],
      resolveCredential
    );

    expect(result).toEqual([
      { integrationId: "statuspage", installed: true, configured: true },
      { integrationId: "linear", installed: true, configured: true },
      { integrationId: "github", installed: false, configured: false },
    ]);
    expect(resolveCredential).toHaveBeenCalledTimes(1);
    expect(resolveCredential).toHaveBeenCalledWith("linear-api");
  });
});
