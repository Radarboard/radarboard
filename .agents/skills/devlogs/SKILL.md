---
name: devlogs
description: >
  Fetch and inspect recent local dev-server logs in this repo. Use when the user
  asks what happened in the server, wants recent dev-server output, needs startup
  errors or stack traces, or asks you to check backend logs. This repo uses the
  devlogs CLI (a built-in replacement for openlogs) that captures Next.js dev
  server output to `.devlogs/`.
---

# Devlogs — Structured Log Capture

This repo uses `@radarboard/devlogs` (packages/devlogs/) — a zero-dependency CLI that
wraps the dev server command and captures all stdout/stderr to `.devlogs/`.

Every API route also emits structured ndjson via `@radarboard/logger`, so logs contain
rich context: request method, path, duration, status, and error details.

## Quick Start

```bash
# Tail the last 200 lines of the most recent run
pnpm devlogs tail -n 200

# Tail a specific command's output
pnpm devlogs tail dev -n 200

# Follow live (for active dev server)
pnpm devlogs tail -f

# Tail last 100 lines of raw output (with ANSI codes)
pnpm devlogs tail --raw -n 100
```

## Log File Locations

| File | Contents |
|---|---|
| `.devlogs/latest.txt` | Cleaned text log of the most recent run |
| `.devlogs/latest.raw.log` | Raw output (with ANSI escape codes) |
| `.devlogs/<command>.txt` | Command-specific latest (e.g. `portless-radarboard-next-dev--turbopack.txt`) |
| `.devlogs/runs.jsonl` | Index of all past runs with timestamps |

## Structured Log Format (ndjson)

Each structured log entry written by `@radarboard/logger` is a JSON line:

```json
{"id":"1700000000-1","timestamp":1700000000000,"level":"info","source":"api/health","message":"request completed","metadata":{"method":"GET","path":"/api/health","status":200,"duration":42}}
```

Fields:
- `id` — unique entry ID
- `timestamp` — Unix ms
- `level` — `"debug"` | `"info"` | `"warn"` | `"error"`
- `source` — e.g. `"api/revenue"`, `"cache"`, `"api/github/repos"`
- `message` — human-readable description
- `metadata` — structured context (method, path, status, duration, error, etc.)

## Workflow

1. Run `pnpm devlogs tail -n 200` to inspect the latest run.
2. If looking for a specific route error, filter with `grep`: `pnpm devlogs tail -n 500 | grep '"level":"error"'`
3. If the dev server is running, use `pnpm devlogs tail -f` for live follow.
4. If `.devlogs/` is missing, the dev server has not been started yet with `devlogs`. Run `pnpm dev` from `apps/app/`.

## Reading Structured Logs

To extract only errors from the text log:
```bash
grep '"level":"error"' .devlogs/latest.txt
```

To find all calls to a specific route:
```bash
grep '"source":"api/revenue"' .devlogs/latest.txt
```

To see slow requests (duration > 1000ms):
```bash
grep -E '"duration":[0-9]{4,}' .devlogs/latest.txt
```

## Response Shape

- Start with the command or file you used.
- Summarize the likely issue in 1–3 sentences.
- Quote the most relevant error lines verbatim.
- If logs are missing, tell the user to run `pnpm dev` from `apps/app/`.
