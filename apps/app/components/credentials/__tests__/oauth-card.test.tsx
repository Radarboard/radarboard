// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OAuthServiceCard } from "../oauth-service-card";

const copyTextMock = vi.fn();
const fetchMock = vi.fn<typeof fetch>();

vi.mock("@/lib/clipboard", () => ({
  copyText: (text: string) => copyTextMock(text),
}));

const githubService = {
  name: "GitHub",
  type: "oauth",
  docsUrl: "https://github.com/settings/developers",
  fields: [
    { key: "clientId", label: "Client ID", type: "text" as const },
    { key: "clientSecret", label: "Client Secret", type: "password" as const },
  ],
  oauth: {
    provider: "github",
    scopes: ["public_repo"],
    normalizeOrigin: false,
    setupInstructions:
      "Create an OAuth App at github.com/settings/developers.\nHomepage URL: {origin}\nAuthorization callback URL: {origin}/api/auth/github/callback",
  },
};

describe("OAuthServiceCard", () => {
  beforeEach(() => {
    copyTextMock.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("renders separate homepage and callback URLs for GitHub setup", async () => {
    const origin = window.location.origin;
    fetchMock.mockResolvedValue({
      json: async () => ({ values: null }),
      ok: true,
    } as Response);

    render(
      <OAuthServiceCard
        credKey="github"
        service={githubService}
        isConnected={false}
        onCredentialChange={vi.fn()}
      />
    );

    expect(await screen.findByText("Homepage URL:")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `Copy ${origin}` })).toBeInTheDocument();
    expect(screen.getByText("Authorization callback URL:")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: `Copy ${origin}/api/auth/github/callback`,
      })
    ).toBeInTheDocument();
  });

  it("shows the finish-setup guidance after saving client credentials", async () => {
    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({ values: null }),
        ok: true,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

    render(
      <OAuthServiceCard
        credKey="github"
        service={githubService}
        isConnected={false}
        onCredentialChange={vi.fn()}
      />
    );

    fireEvent.change(await screen.findByLabelText("Client ID"), {
      target: { value: "client-id" },
    });
    fireEvent.change(screen.getByLabelText("Client Secret"), {
      target: { value: "client-secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save & Continue" }));

    expect(
      await screen.findByText(
        "Credentials saved. Click Connect with GitHub to complete authorization."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect with GitHub" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit credentials" })).toBeInTheDocument();
  });

  it("surfaces clipboard failures in the setup instructions", async () => {
    const origin = window.location.origin;
    copyTextMock.mockRejectedValueOnce(new Error("clipboard unavailable"));
    fetchMock.mockResolvedValue({
      json: async () => ({ values: null }),
      ok: true,
    } as Response);

    render(
      <OAuthServiceCard
        credKey="github"
        service={githubService}
        isConnected={false}
        onCredentialChange={vi.fn()}
      />
    );

    fireEvent.click(await screen.findByRole("button", { name: `Copy ${origin}` }));

    expect(await screen.findByRole("status")).toHaveTextContent("Copy failed");
  });

  it("marks instruction URLs as copied when the clipboard write succeeds", async () => {
    const origin = window.location.origin;
    copyTextMock.mockResolvedValueOnce(true);
    fetchMock.mockResolvedValue({
      json: async () => ({ values: null }),
      ok: true,
    } as Response);

    render(
      <OAuthServiceCard
        credKey="github"
        service={githubService}
        isConnected={false}
        onCredentialChange={vi.fn()}
      />
    );

    const copyButton = await screen.findByRole("button", {
      name: `Copy ${origin}`,
    });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(copyTextMock).toHaveBeenCalledWith(origin);
    });
  });
});
