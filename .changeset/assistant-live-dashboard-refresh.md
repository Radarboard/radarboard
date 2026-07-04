---
"@radarboard/assistant-ui": patch
---

Emit a `radarboard:dashboard-changed` window event when an assistant tool reports it mutated the dashboard (via a `dashboardChanged` flag on its output), so the host app can refresh the dashboard layout live without a reload.
