# MCP Stdio Support Design

## Goal

Extend Radarboard MCP server management from remote HTTP-only to full end-to-end support for local command-based MCP servers, with `npx` as a first-class setup path.

This must cover:
- persistence in the credential store
- validation in the management API
- connection testing from Settings
- runtime tool loading in the embedded copilot
- a transport-aware settings UI

The Settings UI should also move the `Enabled` toggle to the top of the form.

## Current State

Radarboard currently assumes every external MCP server is a streamable HTTP endpoint:

- `packages/types/src/mcp-server.ts` models only `streamable-http`
- `apps/app/app/api/mcp-servers/route.ts` validates only `url` plus `streamable-http`
- `apps/app/app/api/mcp-servers/test/route.ts` only tests HTTP URLs
- `apps/app/lib/mcp-bridge.ts` only builds URL-based AI SDK MCP transport config
- `apps/app/components/settings/settings-mcp-servers/index.tsx` renders a fixed HTTP form

The repo already documents local MCP servers elsewhere using command execution:

- `opencode.json` uses `type: "local"` with `command`
- docs for OpenPanel show `npx`-based MCP setup

The app management surface should align with that model instead of forcing all servers into URL form.

## Recommended Approach

Implement a first-class transport union:

- `streamable-http` for remote MCP servers accessed by URL
- `stdio` for local MCP servers launched as child processes

This is preferred over adding a one-off `npx` mode because:

- it supports `npx` naturally without hardcoding a single launcher
- it matches existing repo conventions for local MCP servers
- it keeps future local transports simple to extend
- it allows runtime execution rather than only storing inert config

## Config Model

`McpServerConfig` becomes a discriminated union.

### Streamable HTTP

- `name`
- `type: "streamable-http"`
- `url`
- `authHeader?`
- `docsUrl?`
- `enabled`

### Stdio

- `name`
- `type: "stdio"`
- `command`
- `args?`
- `env?`
- `cwd?`
- `docsUrl?`
- `enabled`

Credential storage remains string-based. Structured stdio fields will be stored as strings:

- `args` as JSON string array
- `env` as JSON string object
- `cwd` as plain string

Existing HTTP entries remain valid without migration.

## API Changes

### `GET /api/mcp-servers`

Parse stored credentials into either transport shape.

Malformed entries should still be skipped rather than breaking the full list.

### `POST /api/mcp-servers`

Replace the current fixed schema with a discriminated union.

Validation rules:

- common:
  - `name` remains lowercase slug
  - `docsUrl`, if present, must remain a trimmed string
  - `enabled` defaults to `true`
- `streamable-http`:
  - `url` required
  - protocol must be `http` or `https`
  - `authHeader` optional
- `stdio`:
  - `command` required
  - `args` optional string array, default `[]`
  - `env` optional string map, default omitted
  - `cwd` optional string

### `POST /api/mcp-servers/test`

Accept the same transport-aware payload and perform a real `initialize` handshake:

- `streamable-http`: keep the current HTTP initialize behavior
- `stdio`: spawn a process with MCP SDK `StdioClientTransport`, connect a client, and read server info/version from the initialize response

This makes Settings test behavior consistent with runtime behavior.

## Runtime Integration

`apps/app/lib/mcp-bridge.ts` should support both transport types.

### HTTP servers

Keep using `@ai-sdk/mcp` URL transport config.

### Stdio servers

The installed `@ai-sdk/mcp` package does not expose a native stdio config shape, but it does accept a custom transport object. The MCP SDK already provides `StdioClientTransport`, which satisfies the required transport contract.

For stdio servers:

- create `StdioClientTransport` with `command`, `args`, `env`, and `cwd`
- pass it directly to `experimental_createMCPClient`

That keeps one client/tool extraction path for both remote and local MCP servers.

## UI Changes

Update `apps/app/components/settings/settings-mcp-servers/index.tsx` to be transport-aware.

### Layout adjustments

- move `Enabled` directly below the form header
- place `Transport` selection near the top
- keep scroll behavior vertical only

### Transport-specific fields

For `streamable-http`:

- `URL`
- `Auth Header`

For `stdio`:

- `Command`
- `Arguments`
- `Working Directory`
- `Environment Variables`

UI defaults for local servers:

- default transport can stay `streamable-http` for compatibility, or switch to explicit user choice
- when stdio is selected, prefill `command` with `npx`

Arguments should be edited as a simple tokenized text input or newline/list format that serializes to `string[]`. Environment variables should be editable as key/value rows.

The docs URL stays transport-agnostic.

## Testing

Add targeted tests for:

- type parsing and round-tripping of stdio config
- POST route validation for both transports
- GET route reconstruction of stdio credentials
- test route stdio success and failure behavior
- MCP bridge stdio transport creation
- settings UI transport switching and enabled-toggle placement behavior where practical

## Risks

### Process spawning

Local MCP servers will run as child processes from the app runtime. That is expected for stdio MCP, but the implementation must avoid inventing fallback behavior or swallowing spawn failures.

### Stored credential shape

Because credentials are string-based, stdio structured values must be parsed carefully and invalid JSON must not crash the list endpoint.

### Environment handling

The UI should only accept string key/value pairs for environment variables to keep the stored shape predictable and safe to serialize.

## Out of Scope

- auto-importing MCP config from `opencode.json`
- process lifecycle dashboards
- secret interpolation syntax such as `{env:FOO}` in the settings form
- non-stdio local transports beyond command execution

## Implementation Summary

1. Introduce a discriminated MCP server config union in shared types.
2. Update API persistence and parsing for HTTP and stdio entries.
3. Add stdio testing support in `/api/mcp-servers/test`.
4. Extend the MCP bridge to pass custom stdio transport objects into `@ai-sdk/mcp`.
5. Redesign the settings form to support both transports and move `Enabled` to the top.
6. Verify with focused tests and React checks.
