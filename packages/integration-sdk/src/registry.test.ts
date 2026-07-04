import { beforeEach, describe, expect, it } from "vitest";
import {
  DATA_SOURCE_REGISTRY,
  findDataSource,
  getAllIntegrations,
  INTEGRATION_REGISTRY,
  registerIntegration,
  unregisterIntegration,
} from "./registry";
import type { IntegrationDescriptor } from "./types";

function buildDescriptor(overrides: Partial<IntegrationDescriptor> = {}): IntegrationDescriptor {
  return {
    id: "github",
    name: "GitHub",
    description: "GitHub integration for pull requests and issues.",
    icon: () => null,
    category: "communication",
    auth: {
      id: "github",
      name: "GitHub",
      type: "api_key",
      fields: [{ key: "token", label: "Token", type: "password" }],
    },
    dataSources: [
      {
        action: "data",
        description: "Fetch GitHub data",
        cacheTtlSeconds: 60,
        fetch: async () => ({ ok: true }),
      },
    ],
    ...overrides,
  };
}

describe("integration registry", () => {
  beforeEach(() => {
    INTEGRATION_REGISTRY.clear();
    DATA_SOURCE_REGISTRY.clear();
  });

  it("registers integrations and auto-populates their data sources", () => {
    const descriptor = buildDescriptor();

    registerIntegration(descriptor);

    expect(getAllIntegrations()).toEqual([descriptor]);
    expect(findDataSource("github", "data")).toMatchObject({
      action: "data",
      description: "Fetch GitHub data",
    });
  });

  it("rejects duplicate data source actions inside one descriptor", () => {
    const descriptor = buildDescriptor({
      dataSources: [
        {
          action: "data",
          description: "Primary data source",
          cacheTtlSeconds: 60,
          fetch: async () => ({ ok: true }),
        },
        {
          action: "data",
          description: "Duplicate data source",
          cacheTtlSeconds: 120,
          fetch: async () => ({ ok: true }),
        },
      ],
    });

    expect(() => registerIntegration(descriptor)).toThrowError(
      'Integration "github" has duplicate data source action "data".'
    );
  });

  it("unregisters an integration and its data sources", () => {
    registerIntegration(buildDescriptor());
    expect(findDataSource("github", "data")).toBeDefined();

    unregisterIntegration("github");

    expect(getAllIntegrations()).toEqual([]);
    expect(findDataSource("github", "data")).toBeUndefined();
  });

  it("lets a re-registration take effect after unregistering", () => {
    registerIntegration(buildDescriptor({ description: "First." }));
    // Idempotent register is a no-op while the id is present.
    registerIntegration(buildDescriptor({ description: "Second." }));
    expect(INTEGRATION_REGISTRY.get("github")?.description).toBe("First.");

    unregisterIntegration("github");
    registerIntegration(buildDescriptor({ description: "Second." }));
    expect(INTEGRATION_REGISTRY.get("github")?.description).toBe("Second.");
  });
});
