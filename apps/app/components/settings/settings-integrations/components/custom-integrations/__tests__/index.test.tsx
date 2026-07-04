// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useUserIntegrations = vi.fn();

vi.mock("@/hooks/settings/use-user-integrations", () => ({
  useUserIntegrations: () => useUserIntegrations(),
}));

import { CustomIntegrationsSection } from "../index";

const remove = vi.fn();

function mockHook(overrides: Record<string, unknown> = {}) {
  useUserIntegrations.mockReturnValue({
    integrations: [],
    loading: false,
    error: null,
    refetch: vi.fn(),
    remove,
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CustomIntegrationsSection", () => {
  it("renders nothing while loading (avoids an empty-state flash)", () => {
    mockHook({ loading: true });
    const { container } = render(<CustomIntegrationsSection />);
    expect(container.firstChild).toBeNull();
  });

  it("shows a discovery hint when there are no integrations", () => {
    mockHook({ integrations: [] });
    render(<CustomIntegrationsSection />);
    expect(screen.getByText("No custom integrations yet")).toBeTruthy();
    expect(screen.getByText(/Ask the assistant to connect any REST API/)).toBeTruthy();
  });

  it("lists integrations with a remove control", () => {
    mockHook({
      integrations: [
        {
          id: "coingecko",
          name: "CoinGecko",
          category: "revenue",
          baseUrl: "https://api.coingecko.com",
          dataSourceActions: ["prices"],
        },
      ],
    });
    render(<CustomIntegrationsSection />);
    expect(screen.getByText("CoinGecko")).toBeTruthy();
    expect(screen.getByText(/api\.coingecko\.com/)).toBeTruthy();
    expect(screen.getByText(/1 action/)).toBeTruthy();
    // The confirm-dialog open flow is covered by app-dialog's own tests and was
    // verified live; here we only assert the remove control is present.
    expect(screen.getByRole("button", { name: "Remove" })).toBeTruthy();
  });
});
