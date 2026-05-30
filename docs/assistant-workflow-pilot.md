# Assistant Workflow Pilot

This repo now has first-class workflow modes inside Radarboard: `explore`, `plan`, `review`, and `qa`.

For the next 1-2 weeks, run an internal workflow pilot with `gstack` alongside the in-app assistant:

1. Start ideation and problem framing with `gstack /office-hours` or Radarboard `explore` mode.
2. Convert approved direction into a durable Radarboard `plan` artifact.
3. Run `gstack /review` or Radarboard `review` mode on the resulting implementation work.
4. Run Radarboard `qa` mode for structured browser QA when `agent-browser` is configured.
5. When a second opinion matters, enable Radarboard's challenger model in `review` mode.

Use the saved Radarboard artifacts as the durable record of the workflow. `gstack` remains the operating process around the repo; Radarboard stores the reusable outputs and exposes them to both the in-app assistant and external MCP clients.
