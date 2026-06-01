// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ServiceEntry } from "../../../types";
import { ServiceCard } from "../service-card";

vi.mock("@/lib/service-favicons", () => ({
  getServiceFaviconUrl: () => null,
}));

const service: ServiceEntry = {
  credKey: "openpanel",
  auth: {
    id: "openpanel",
    name: "OpenPanel",
    type: "api_key",
    fields: [
      { key: "clientId", label: "Client ID", type: "text" },
      { key: "clientSecret", label: "Client Secret", type: "password" },
    ],
  },
  usedByWidgets: [],
  pollingSourceIds: [],
  description: "Product analytics",
};

describe("ServiceCard", () => {
  it.each([
    {
      name: "API credentials are configured without connection rows",
      props: { connectionCount: 0, apiConfigured: true, mcpReady: false },
      status: "API configured",
      badges: ["API"],
    },
    {
      name: "MCP is configured without connection rows",
      props: { connectionCount: 0, apiConfigured: false, mcpReady: true },
      status: "MCP configured",
      badges: ["MCP"],
    },
    {
      name: "API and MCP are configured without connection rows",
      props: { connectionCount: 0, apiConfigured: true, mcpReady: true },
      status: "API + MCP configured",
      badges: ["API", "MCP"],
    },
    {
      name: "nothing is configured",
      props: { connectionCount: 0, apiConfigured: false, mcpReady: false },
      status: "Not configured",
      badges: [],
    },
  ])("reports the correct status when $name", ({ props, status, badges }) => {
    render(
      <ServiceCard
        service={service}
        connectionCount={props.connectionCount}
        apiConfigured={props.apiConfigured}
        mcpReady={props.mcpReady}
        onClick={vi.fn()}
      />
    );

    expect(screen.getByText(status)).toBeInTheDocument();
    for (const badge of badges) {
      expect(screen.getByText(badge)).toBeInTheDocument();
    }

    if (status !== "Not configured") {
      expect(screen.queryByText("Not configured")).not.toBeInTheDocument();
    }
  });

  it("keeps connection counts when connection rows exist", () => {
    render(
      <ServiceCard
        service={service}
        connectionCount={2}
        apiConfigured={true}
        mcpReady={true}
        onClick={vi.fn()}
      />
    );

    expect(screen.getByText("2 connections")).toBeInTheDocument();
  });
});
