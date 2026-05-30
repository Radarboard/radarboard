// @vitest-environment jsdom
import type { HealthCheck, HealthIncident } from "@radarboard/types/health";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { HealthMonitors } from "../components/health-monitors";

const CHECKS: HealthCheck[] = [
  {
    id: "check_1",
    name: "api.goshuin.app",
    url: "https://api.goshuin.app",
    status: "up",
    responseTimeMs: 140,
    lastCheckedAt: new Date(Date.now() - 60_000).toISOString(),
  },
];

const INCIDENTS: HealthIncident[] = [
  {
    id: "incident_1",
    name: "API Latency Spike",
    url: "https://status.goshuin.app",
    cause: "database failover",
    startedAt: new Date(Date.now() - 7_200_000).toISOString(),
  },
];

describe("HealthMonitors", () => {
  it("renders incidents and checks with shared row/list primitives", async () => {
    render(createElement(HealthMonitors, { checks: CHECKS, incidents: INCIDENTS }));

    expect(await screen.findByText("API Latency Spike")).toBeTruthy();
    expect(screen.getByText("Check")).toBeTruthy();
    expect(screen.getByText("Latency")).toBeTruthy();
    expect(screen.getByText("Time")).toBeTruthy();
    expect(screen.getByText("api.goshuin.app")).toBeTruthy();
    expect(screen.getByText("140ms")).toBeTruthy();
  });
});
