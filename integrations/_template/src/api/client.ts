/**
 * __INTEGRATION_NAME__ API client.
 *
 * Wraps the __INTEGRATION_NAME__ REST API. All methods require a valid API key
 * obtained from the integration credentials.
 *
 * Usage in data sources:
 *   const creds = await ctx.resolveCredential("__INTEGRATION_KEBAB__");
 *   const items = await fetchItems(creds!.apiKey);
 */

import type { __INTEGRATION_PASCAL__Config, __INTEGRATION_PASCAL__Item } from "../types";

const BASE_URL = "https://api.example.com/v1";

/**
 * Fetch items from the __INTEGRATION_NAME__ API.
 *
 * @param config - Credentials containing the API key.
 * @returns Array of items from the API.
 * @throws {Error} If the API returns a non-OK status.
 *
 * @example
 * ```ts
 * const items = await fetchItems({ apiKey: "sk_..." });
 * console.log(items); // [{ id: "1", name: "Item 1", ... }]
 * ```
 */
export async function fetchItems(
  config: __INTEGRATION_PASCAL__Config
): Promise<__INTEGRATION_PASCAL__Item[]> {
  const res = await fetch(`${BASE_URL}/items`, {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`__INTEGRATION_NAME__ API error: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as { data: __INTEGRATION_PASCAL__Item[] };
  return json.data;
}
