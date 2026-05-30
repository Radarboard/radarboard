// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsInfrastructure } from "../index";

const getIntegration = vi.fn();
const updateIntegration = vi.fn();

vi.mock("@/hooks/projects/use-project-integrations", () => ({
  useProjectIntegrations: () => ({
    getIntegration,
    updateIntegration,
  }),
}));

describe("SettingsInfrastructure", () => {
  beforeEach(() => {
    getIntegration.mockReset();
    updateIntegration.mockReset();
  });

  it("shows the empty relay state and webhook-capable integrations", () => {
    getIntegration.mockReturnValue(null);

    render(<SettingsInfrastructure />);

    expect(screen.getByText("Relay base URL not configured")).toBeTruthy();
    expect(screen.getByText("No relay URL configured yet")).toBeTruthy();
    expect(screen.getByText("GitHub")).toBeTruthy();
    expect(screen.getByText("Vercel")).toBeTruthy();
  });

  it("saves a normalized relay url", () => {
    getIntegration.mockReturnValue("");

    render(<SettingsInfrastructure />);

    fireEvent.change(screen.getByLabelText("Relay URL"), {
      target: { value: " https://relay.radarboard.app/ " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Relay URL" }));

    expect(updateIntegration).toHaveBeenCalledWith(
      "@@system",
      "relay",
      "url",
      "https://relay.radarboard.app"
    );
  });

  it("clears the current relay url", () => {
    getIntegration.mockReturnValue("https://relay.radarboard.app");

    render(<SettingsInfrastructure />);

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(updateIntegration).toHaveBeenCalledWith("@@system", "relay", "url", "");
  });

  it("shows the configured relay status", () => {
    getIntegration.mockReturnValue("https://relay.radarboard.app/");

    render(<SettingsInfrastructure />);

    expect(screen.getByText("Relay base URL configured")).toBeTruthy();
    expect(
      screen.getByText(
        "Provider endpoints are currently derived from https://relay.radarboard.app."
      )
    ).toBeTruthy();
  });
});
