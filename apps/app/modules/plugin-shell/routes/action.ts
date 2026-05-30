import { Client } from "@modelcontextprotocol/sdk/client";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createLogger } from "@radarboard/logger/logger";
import {
  getChangelogStateRoute,
  importChangelogDependenciesRoute,
  syncChangelogRoute,
} from "@radarboard/plugin-changelog/server/routes";
import { discoverFeedFromUrl, FeedDiscoveryError } from "@radarboard/plugin-rss-reader/discovery";
import { extractArticleContent } from "@radarboard/plugin-rss-reader/server/article-content";
import {
  getReadAloudMode,
  synthesizeWithPiper,
} from "@radarboard/plugin-rss-reader/server/read-aloud";
import { syncRssFeedsRoute } from "@radarboard/plugin-rss-reader/server/routes";
import { saveArticleToRaindrop } from "@radarboard/plugin-rss-reader/server/save-article";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCredentialRepo } from "@/db/repository";
import { errorJson, parseBody } from "@/lib/api";
import {
  getChangelogState,
  importChangelogDependencies,
  syncChangelog,
} from "@/lib/changelog-server";
import { getWebEnv, WEB_ENV_KEYS } from "@/lib/env";
import { parseStoredMcpServerConfig, resolveMcpServerConfig } from "@/lib/mcp-server-config";
import { syncRssFeeds } from "@/lib/rss-reader-server";

export type PluginRouteContext = {
  params: Promise<{ plugin: string; action: string }>;
};

const RssDiscoverSchema = z.object({
  url: z.string().min(1),
});

const RssArticleSchema = z.object({
  url: z.string().url(),
});

const RssReadAloudSchema = z.object({
  text: z.string().min(1),
});

const RssSaveSchema = z.object({
  target: z.literal("raindrop"),
  title: z.string().min(1),
  url: z.string().url(),
  excerpt: z.string().optional(),
});

const RssSyncSchema = z
  .object({
    emitNotifications: z.boolean().optional(),
  })
  .optional();

const ChangelogImportSchema = z.object({
  projectSlug: z.string().min(1),
  platformId: z.string().min(1),
});

const ChangelogSyncSchema = z
  .object({
    force: z.boolean().optional(),
  })
  .optional();

function getPiperConfig() {
  return {
    modelPath: getWebEnv(WEB_ENV_KEYS.tts.piperModelPath),
    command: getWebEnv(WEB_ENV_KEYS.tts.piperCommand),
    speaker: getWebEnv(WEB_ENV_KEYS.tts.piperSpeaker),
  };
}

function statusForDiscoveryError(error: FeedDiscoveryError): number {
  switch (error.code) {
    case "invalid_url":
      return 400;
    case "feed_not_found":
      return 404;
    case "fetch_failed":
      return 502;
    default:
      return 500;
  }
}

async function withRaindropClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const repo = getCredentialRepo();
  const values = await repo.getCredential("mcp::raindrop");
  if (!values) {
    throw new Error("Raindrop MCP server is not configured");
  }

  const server = parseStoredMcpServerConfig("raindrop", values);
  if (!server || !server.enabled) {
    throw new Error("Raindrop MCP server is disabled");
  }

  const resolved = await resolveMcpServerConfig(server, (key) => repo.getCredential(key));

  const transport =
    resolved.type === "stdio"
      ? new StdioClientTransport({
          command: resolved.command,
          args: resolved.args,
          env: resolved.env,
          cwd: resolved.cwd,
        })
      : (() => {
          const headers = resolved.authHeader
            ? (() => {
                const authHeaders = new Headers();
                authHeaders.set("Authorization", resolved.authHeader);
                return authHeaders;
              })()
            : undefined;

          return new StreamableHTTPClientTransport(new URL(resolved.url), {
            requestInit: {
              headers,
            },
          });
        })();

  const client = new Client({
    name: "radarboard-plugin-route",
    version: "1.0.0",
  });

  await client.connect(transport);
  try {
    return await fn(client);
  } finally {
    await client.close();
  }
}

function routeLogger(plugin: string, action: string) {
  return createLogger(`api/plugins/${plugin}/${action}`);
}

async function handleChangelogGet(action: string) {
  if (action !== "state") {
    return errorJson(404, "Not found");
  }
  return NextResponse.json(await getChangelogStateRoute(getChangelogState));
}

async function handleChangelogPost(action: string, request: Request) {
  if (action === "import") {
    const parsed = await parseBody(request, ChangelogImportSchema);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json(
      await importChangelogDependenciesRoute(importChangelogDependencies, parsed.data)
    );
  }

  if (action === "sync") {
    const parsed = await parseBody(request, ChangelogSyncSchema);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json(
      await syncChangelogRoute(syncChangelog, { force: parsed.data?.force })
    );
  }

  return errorJson(404, "Not found");
}

async function handleRssGet(action: string) {
  if (action !== "read-aloud") {
    return errorJson(404, "Not found");
  }

  return NextResponse.json({
    ok: true,
    mode: getReadAloudMode(getPiperConfig()),
  });
}

async function handleRssPost(action: string, request: Request) {
  if (action === "discover") {
    const parsed = await parseBody(request, RssDiscoverSchema);
    if (!parsed.ok) return parsed.response;
    const result = await discoverFeedFromUrl(parsed.data.url);
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === "article") {
    const parsed = await parseBody(request, RssArticleSchema);
    if (!parsed.ok) return parsed.response;
    const result = await extractArticleContent(parsed.data.url);
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === "read-aloud") {
    const parsed = await parseBody(request, RssReadAloudSchema);
    if (!parsed.ok) return parsed.response;
    const audio = await synthesizeWithPiper(parsed.data.text, getPiperConfig());
    if (!audio) {
      return errorJson(503, "Piper is not configured", { ok: false });
    }
    return new NextResponse(new Uint8Array(audio), {
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "no-store",
      },
    });
  }

  if (action === "save") {
    const parsed = await parseBody(request, RssSaveSchema);
    if (!parsed.ok) return parsed.response;
    const result = await withRaindropClient((client) => saveArticleToRaindrop(client, parsed.data));
    return NextResponse.json({ ok: true, result });
  }

  if (action === "sync") {
    const parsed = await parseBody(request, RssSyncSchema);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json(
      await syncRssFeedsRoute(syncRssFeeds, { emitNotifications: parsed.data?.emitNotifications })
    );
  }

  return errorJson(404, "Not found");
}

export async function handlePluginActionGet(_request: Request, context: PluginRouteContext) {
  const { plugin, action } = await context.params;
  const log = routeLogger(plugin, action);

  try {
    if (plugin === "changelog") return await handleChangelogGet(action);
    if (plugin === "rss-reader") return await handleRssGet(action);
    return errorJson(404, "Not found");
  } catch (error) {
    log.error("Plugin route GET failed", { error });
    return errorJson(500, error instanceof Error ? error.message : "Plugin route failed", {
      ok: false,
    });
  }
}

export async function handlePluginActionPost(request: Request, context: PluginRouteContext) {
  const { plugin, action } = await context.params;
  const log = routeLogger(plugin, action);

  try {
    if (plugin === "changelog") return await handleChangelogPost(action, request);
    if (plugin === "rss-reader") return await handleRssPost(action, request);
    return errorJson(404, "Not found");
  } catch (error) {
    log.error("Plugin route POST failed", { error });
    if (error instanceof FeedDiscoveryError) {
      return errorJson(statusForDiscoveryError(error), error.message, {
        ok: false,
        code: error.code,
      });
    }
    return errorJson(500, error instanceof Error ? error.message : "Plugin route failed", {
      ok: false,
    });
  }
}
