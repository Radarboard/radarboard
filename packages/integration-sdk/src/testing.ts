import type { DataSourceContext } from "./types";

// ---------------------------------------------------------------------------
// Tracked mock DataSourceContext — records calls for assertion
// ---------------------------------------------------------------------------

/** Extended DataSourceContext that records calls for test assertions. */
export interface TrackedDataSourceContext extends DataSourceContext {
  /** Direct access to the in-memory credential store for assertions. */
  credentialStore: Map<string, Record<string, string>>;
  /** All credential keys requested via `resolveCredential()`. */
  resolvedCredentialKeys: string[];
  /** Number of times `getProjectIntegrations()` was called. */
  getProjectIntegrationsCallCount: number;
  /** Number of times `getAllProjects()` was called. */
  getAllProjectsCallCount: number;
  /** Reset all tracked state. */
  resetTracking: () => void;
}

/**
 * Create a mock DataSourceContext backed by an in-memory credential Map.
 * Useful for testing integration data-source `fetch` functions.
 *
 * @param credentials - Optional record of credential key → field values to pre-seed.
 *
 * Usage:
 * ```ts
 * const ctx = createMockDataSourceContext({
 *   vercel: { authToken: "tok_test_123" },
 * });
 * const data = await myDataSource.fetch(params, ctx);
 * ```
 */
export function createMockDataSourceContext(
  credentials?: Record<string, Record<string, string>>
): TrackedDataSourceContext {
  const credentialStore = new Map<string, Record<string, string>>(
    credentials ? Object.entries(credentials) : []
  );
  const resolvedCredentialKeys: string[] = [];
  let getProjectIntegrationsCallCount = 0;
  let getAllProjectsCallCount = 0;

  const ctx: TrackedDataSourceContext = {
    credentialStore,
    resolvedCredentialKeys,
    getProjectIntegrationsCallCount: 0,
    getAllProjectsCallCount: 0,

    resetTracking: () => {
      resolvedCredentialKeys.length = 0;
      getProjectIntegrationsCallCount = 0;
      getAllProjectsCallCount = 0;
      ctx.getProjectIntegrationsCallCount = 0;
      ctx.getAllProjectsCallCount = 0;
    },

    resolveCredential: async (key: string) => {
      resolvedCredentialKeys.push(key);
      return credentialStore.get(key) ?? null;
    },

    getProjectIntegrations: async () => {
      getProjectIntegrationsCallCount++;
      ctx.getProjectIntegrationsCallCount = getProjectIntegrationsCallCount;
      return {};
    },

    getAllProjects: async () => {
      getAllProjectsCallCount++;
      ctx.getAllProjectsCallCount = getAllProjectsCallCount;
      return [];
    },

    getMcpClient: (_url: string, _authHeader?: string) => ({
      callToolJson: async <T>(_tool: string, _args: Record<string, unknown>): Promise<T> => {
        throw new Error("MCP client not implemented in test harness");
      },
    }),

    listMcpToolsByName: async (_name: string) => [],

    callMcpToolJsonByName: async <T>(
      _name: string,
      _tool: string,
      _args: Record<string, unknown>
    ): Promise<T> => {
      throw new Error("callMcpToolJsonByName not implemented in test harness");
    },
  };

  return ctx;
}
