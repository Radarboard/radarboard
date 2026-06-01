// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { IntegrationSandbox } from "../index";

vi.mock("@/lib/integrations-init", () => ({}));

vi.mock("@radarboard/integration-sdk/registry", () => ({
  getAllIntegrations: () => [
    {
      id: "revenuecat",
      name: "RevenueCat",
      description: "Revenue data.",
      category: "revenue",
      auth: {
        id: "revenuecat",
        name: "RevenueCat",
        type: "api_key",
        fields: [],
      },
      dataSources: [],
    },
  ],
}));

vi.mock("@radarboard/integration-sdk/testing", () => ({
  createMockDataSourceContext: () => ({}),
}));

describe("IntegrationSandbox", () => {
  it("renders registered integrations from the runtime registry", () => {
    render(createElement(IntegrationSandbox));

    expect(screen.getByText("RevenueCat (revenue)")).toBeTruthy();
  });
});
