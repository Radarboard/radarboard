#!/usr/bin/env node
import http from "node:http";
import https from "node:https";

const DEFAULT_MCP_URL = "https://radarboard.localhost:1355/api/mcp";
const mcpUrl = new URL(process.env.RADARBOARD_MCP_URL ?? DEFAULT_MCP_URL);
const token = process.env.RADARBOARD_MCP_TOKEN;

if (!token) {
  console.error("RADARBOARD_MCP_TOKEN is required. Generate one with: pnpm mcp:token");
  process.exit(1);
}

function reportFailure(error) {
  const message = error instanceof Error ? error.message : String(error);
  const code = error && typeof error === "object" && "code" in error ? error.code : null;
  if (code === "ENOTFOUND" || code === "ECONNREFUSED") {
    console.error(`Could not reach ${mcpUrl.origin}.`);
    console.error("Start the Radarboard app with portless before running: pnpm mcp:verify");
    console.error(`Underlying error: ${message}`);
    process.exit(1);
  }
  console.error(message);
  process.exit(1);
}

process.on("uncaughtException", reportFailure);
process.on("unhandledRejection", reportFailure);

function isLocalHttps(url) {
  return (
    url.protocol === "https:" &&
    (url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "::1" ||
      url.hostname.endsWith(".localhost"))
  );
}

function request(url, options = {}) {
  const body = options.body ? Buffer.from(options.body) : null;
  const client = url.protocol === "http:" ? http : https;
  const headers = { ...(options.headers ?? {}) };
  if (body) headers["Content-Length"] = String(body.length);

  return new Promise((resolve, reject) => {
    const req = client.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method: options.method ?? "GET",
        headers,
        rejectUnauthorized: !isLocalHttps(url),
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () =>
          resolve({
            statusCode: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          })
        );
      }
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function parseJsonOrSse(body) {
  const trimmed = body.trim();
  if (trimmed.startsWith("data:")) {
    const dataLine = trimmed
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice("data:".length).trim())
      .find((line) => line && line !== "[DONE]");
    if (!dataLine) throw new Error("MCP response had no data payload");
    return JSON.parse(dataLine);
  }
  return JSON.parse(trimmed);
}

function expectStatus(response, expected, label) {
  if (response.statusCode !== expected) {
    throw new Error(`${label} returned HTTP ${response.statusCode}, expected ${expected}`);
  }
}

function expectOk(response, label) {
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`${label} returned HTTP ${response.statusCode}: ${response.body}`);
  }
}

const jsonHeaders = {
  Accept: "application/json, text/event-stream",
  "Content-Type": "application/json",
};

const initializeBody = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "radarboard-local-verify", version: "1.0.0" },
  },
});

const toolsListBody = JSON.stringify({
  jsonrpc: "2.0",
  id: 2,
  method: "tools/list",
  params: {},
});

const discoveryUrl = new URL("/.well-known/oauth-protected-resource", mcpUrl.origin);
const discovery = await request(discoveryUrl);
expectStatus(discovery, 200, "Protected-resource discovery");

const unauthorized = await request(mcpUrl, {
  method: "POST",
  headers: jsonHeaders,
  body: initializeBody,
});
expectStatus(unauthorized, 401, "Unauthenticated MCP initialize");

const authenticatedHeaders = {
  ...jsonHeaders,
  Authorization: `Bearer ${token}`,
};

const initialized = await request(mcpUrl, {
  method: "POST",
  headers: authenticatedHeaders,
  body: initializeBody,
});
expectOk(initialized, "Authenticated MCP initialize");

const listed = await request(mcpUrl, {
  method: "POST",
  headers: authenticatedHeaders,
  body: toolsListBody,
});
expectOk(listed, "Authenticated tools/list");

const parsed = parseJsonOrSse(listed.body);
const tools = parsed.result?.tools ?? parsed.tools ?? [];
if (!Array.isArray(tools)) {
  throw new Error("tools/list response did not include a tools array");
}

const toolNames = new Set(tools.map((tool) => tool.name));
const missing = ["get_notifications", "get_debug_events", "list_artifacts"].filter(
  (name) => !toolNames.has(name)
);
if (missing.length > 0) {
  throw new Error(`tools/list is missing expected tools: ${missing.join(", ")}`);
}

console.log(`Radarboard MCP verified at ${mcpUrl.href}`);
console.log(`Available tools: ${tools.length}`);
