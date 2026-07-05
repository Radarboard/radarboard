# Radarboard Desktop desktop-v0.1.1-beta.8

## Highlights

- The background helper process no longer appears as its own icon in the macOS Dock — it now runs as an accessory process alongside the main Radarboard window.
- The helper is reliably shut down whenever Radarboard exits — including after a crash, a Force Quit, or an in-place update — so stale helper processes no longer linger and hold onto a port.
- No-code REST integrations: connect any REST API through the assistant (or an MCP client), render its data on the dashboard, and view or remove your integrations from Settings → Integrations.
- Clearer failure feedback in settings — saving or removing credentials, MCP servers, and connections now surfaces an error instead of silently appearing to succeed.

## Install notes

- Replace any previously installed beta with this DMG. Your data in `~/Library/Application Support/Radarboard` is preserved.
- After updating, quit and relaunch Radarboard once so the new helper takes effect.
