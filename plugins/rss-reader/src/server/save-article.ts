export interface SaveArticleInput {
  title: string;
  url: string;
  excerpt?: string;
}

export interface McpToolLike {
  name: string;
  inputSchema?: Record<string, unknown>;
}

export interface McpClientLike {
  listTools(): Promise<{ tools: McpToolLike[] }>;
  callTool(input: { name: string; arguments: Record<string, unknown> }): Promise<unknown>;
}

const BOOKMARK_TAGS = ["rss", "radarboard"];

function selectCreateAction(schema: Record<string, unknown>): string | null {
  const actionProp = schema.action as { enum?: unknown[] } | undefined;
  const operationProp = schema.operation as { enum?: unknown[] } | undefined;

  const candidates = [actionProp, operationProp]
    .flatMap((prop) => (Array.isArray(prop?.enum) ? prop.enum : []))
    .filter((value): value is string => typeof value === "string");

  return candidates.find((value) => ["create", "add", "save"].includes(value)) ?? null;
}

function buildBookmarkManageArgs(
  inputSchema: Record<string, unknown>,
  input: SaveArticleInput
): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  const props = (inputSchema.properties as Record<string, unknown> | undefined) ?? {};
  const excerpt = input.excerpt ?? "";
  const bookmarkPayload = {
    title: input.title,
    url: input.url,
    excerpt,
    description: excerpt,
    tags: BOOKMARK_TAGS,
  };

  const setArgIfSupported = (key: string, value: unknown) => {
    if (value !== undefined && value !== null && key in props) {
      args[key] = value;
    }
  };

  const createAction = selectCreateAction(props);
  setArgIfSupported("action", createAction);
  setArgIfSupported("operation", createAction);
  setArgIfSupported("title", input.title);
  setArgIfSupported("url", input.url);
  setArgIfSupported("link", input.url);
  setArgIfSupported("description", excerpt);
  setArgIfSupported("excerpt", excerpt);
  setArgIfSupported("tags", BOOKMARK_TAGS);
  setArgIfSupported("bookmark", bookmarkPayload);

  return args;
}

export async function saveArticleToRaindrop(
  client: McpClientLike,
  input: SaveArticleInput
): Promise<unknown> {
  const tools = await client.listTools();
  const tool = tools.tools.find((candidate) =>
    ["bookmark_manage", "add_bookmark"].includes(candidate.name)
  );

  if (!tool) {
    throw new Error("Raindrop MCP server does not expose a bookmark creation tool");
  }

  const args =
    tool.name === "bookmark_manage"
      ? buildBookmarkManageArgs((tool.inputSchema as Record<string, unknown>) ?? {}, input)
      : {
          title: input.title,
          url: input.url,
          description: input.excerpt ?? "",
          tags: BOOKMARK_TAGS,
        };

  return client.callTool({
    name: tool.name,
    arguments: args,
  });
}
