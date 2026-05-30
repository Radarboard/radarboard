/**
 * __INTEGRATION_NAME__ — MCP tool definitions
 *
 * MCP tools let the AI assistant interact with __INTEGRATION_NAME__ on behalf
 * of the user. Each tool has a name, description, Zod parameters schema,
 * and an execute function.
 *
 * Example tool definition:
 *
 *   {
 *     name: "get-__INTEGRATION_KEBAB__-items",
 *     description: "Fetch items from __INTEGRATION_NAME__ for a given project.",
 *     parameters: z.object({
 *       projectSlug: z.string().describe("The project slug to query"),
 *       status: z.enum(["active", "inactive"]).optional().describe("Filter by status"),
 *     }),
 *     execute: async (params: { projectSlug: string; status?: string }) => {
 *       // Use the API client to fetch data:
 *       //   import { fetchItems } from "../api/client";
 *       //   const items = await fetchItems({ apiKey: resolvedKey });
 *       //   return items.filter(i => !params.status || i.status === params.status);
 *       return { status: "not_implemented" };
 *     },
 *   }
 *
 * Add tool objects to the array below when ready.
 */

export const __INTEGRATION_CAMEL__McpTools: Array<unknown> = [
  // Add MCP tool definitions here — see the example in the comment above.
  // import { z } from "zod" to define parameter schemas.
];
