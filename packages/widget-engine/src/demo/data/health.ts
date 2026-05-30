import type { HealthCheck } from "@radarboard/types/health";

// --- Health Checks ---
export const MOCK_HEALTH_CHECKS: HealthCheck[] = [
  {
    id: "h1",
    name: "pixelstudio.app",
    url: "https://pixelstudio.app",
    status: "up",
    responseTimeMs: 142,
    lastCheckedAt: "2026-03-16T14:55:00Z",
    projectName: "Pixel Studio",
  },
  {
    id: "h2",
    name: "editor.pixelstudio.app",
    url: "https://editor.pixelstudio.app",
    status: "up",
    responseTimeMs: 89,
    lastCheckedAt: "2026-03-16T14:55:00Z",
    projectName: "Pixel Studio",
  },
  {
    id: "h3",
    name: "API",
    url: "https://api.pixelstudio.app",
    status: "up",
    responseTimeMs: 45,
    lastCheckedAt: "2026-03-16T14:55:00Z",
    projectName: "Pixel Studio",
  },
];
