/**
 * __INTEGRATION_NAME__ — Data source descriptors
 *
 * Each data source maps to an API route: /api/integrations/__INTEGRATION_KEBAB__/<action>
 * The `fetch` function receives route params and a DataSourceContext for
 * resolving credentials and project config.
 */

import type { DataSourceDescriptor } from "@radarboard/integration-sdk/types";
import type { __INTEGRATION_PASCAL__Data } from "../types";
import { fetchItems } from "./client";

/**
 * Main data source — fetches items from __INTEGRATION_NAME__.
 *
 * Accessed via: GET /api/integrations/__INTEGRATION_KEBAB__/data
 */
export const __INTEGRATION_CAMEL__DataSource: DataSourceDescriptor = {
  action: "data",
  description: "Fetches items from __INTEGRATION_NAME__.",
  cacheTtlSeconds: 120,
  pollingSourceId: "__INTEGRATION_KEBAB__",
  buildCacheKey: (params) => `__INTEGRATION_KEBAB__:${params.projectSlug ?? "all"}`,

  async fetch(_params, ctx) {
    // 1. Resolve credentials stored by the user in Settings → Integrations
    const creds = await ctx.resolveCredential("__INTEGRATION_KEBAB__");
    if (!creds?.apiKey) {
      return { items: [], totalCount: 0, fetchedAt: new Date().toISOString() };
    }

    // 2. Call the API client
    const items = await fetchItems({ apiKey: creds.apiKey });

    // 3. Return normalized data
    const result: __INTEGRATION_PASCAL__Data = {
      items,
      totalCount: items.length,
      fetchedAt: new Date().toISOString(),
    };
    return result;
  },
};

// biome-ignore lint/suspicious/noExplicitAny: data-source descriptor requires heterogeneous type params
export const __INTEGRATION_CAMEL__DataSources: DataSourceDescriptor<any, any>[] = [
  __INTEGRATION_CAMEL__DataSource,
];
