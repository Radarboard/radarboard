#!/usr/bin/env node
/**
 * Mint a long-lived MCP dev token for local Claude Code usage.
 * Usage: node scripts/mint-mcp-dev-token.mjs
 *
 * Reads RADARBOARD_API_SECRET from apps/app/.env.local and generates
 * a 1-year JWT that the /api/mcp endpoint will accept.
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(resolve(__dirname, "../apps/app/package.json"));
const { SignJWT } = require("jose");

const envPath = resolve(__dirname, "../apps/app/.env.local");
const envText = readFileSync(envPath, "utf-8");

function readEnvValue(name) {
  const match = envText.match(new RegExp(`^${name}=(.+)$`, "m"));
  if (!match) return null;
  return match[1].trim().replace(/^["']|["']$/g, "");
}

const apiSecret = readEnvValue("RADARBOARD_API_SECRET");
if (!apiSecret) {
  console.error("RADARBOARD_API_SECRET not found in apps/app/.env.local");
  process.exit(1);
}

const appUrl = readEnvValue("NEXT_PUBLIC_APP_URL") ?? "https://radarboard.localhost:1355";
const secret = new TextEncoder().encode(apiSecret);

const token = await new SignJWT({ client_id: "claude-code-dev", scope: "read" })
  .setProtectedHeader({ alg: "HS256" })
  .setIssuer(appUrl)
  .setAudience(appUrl)
  .setSubject("chatgpt-connector")
  .setIssuedAt()
  .setExpirationTime("31536000s")
  .sign(secret);

console.log(token);
