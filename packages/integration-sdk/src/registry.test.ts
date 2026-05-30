import { beforeEach, describe, expect, it } from "vitest";
import {
  DATA_SOURCE_REGISTRY,
  findDataSource,
  getAllIntegrations,
  INTEGRATION_REGISTRY,
  registerIntegration,
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
});
