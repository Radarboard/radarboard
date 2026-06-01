// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OAuthServiceCard } from "../oauth-service-card";

const copyTextMock = vi.fn();
const fetchMock = vi.fn<typeof fetch>();
const platformMock = vi.hoisted(() => ({
  isTauri: false,
  openExternalUrl: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock("@/lib/clipboard", () => ({
  copyText: (text: string) => copyTextMock(text),
}));

vi.mock("@/lib/platform", () => ({
  isTauri: () => platformMock.isTauri,
}));

vi.mock("@/lib/system/ui/external-url", () => ({
  handleExternalLinkClick: vi.fn(),
  openExternalUrl: (url: string) => platformMock.openExternalUrl(url),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (command: string) => platformMock.invoke(command),
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

const googleService = {
  name: "Google Search Console",
  type: "oauth",
  docsUrl: "https://console.cloud.google.com/apis/credentials",
  fields: [
    { key: "clientId", label: "Client ID", type: "text" as const },
    { key: "clientSecret", label: "Client Secret", type: "password" as const },
  ],
  oauth: {
    provider: "google",
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
    setupInstructions:
      "Create OAuth credentials in Google Cloud Console. Set the callback URL to:\n{origin}/api/auth/google/callback",
  },
};

describe("OAuthServiceCard", () => {
  beforeEach(() => {
    copyTextMock.mockReset();
    fetchMock.mockReset();
    platformMock.isTauri = false;
    platformMock.openExternalUrl.mockReset();
    platformMock.openExternalUrl.mockResolvedValue(undefined);
    platformMock.invoke.mockReset();
    platformMock.invoke.mockResolvedValue("radarboard");
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

  it("refreshes the card state after importing Google credentials from gws CLI", async () => {
    const onCredentialChange = vi.fn();
    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({ values: null }),
        ok: true,
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({ imported: true }),
        ok: true,
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          values: {
            clientId: "google-client-id",
            clientSecret: "google-client-secret",
            refreshToken: "google-refresh-token",
          },
        }),
        ok: true,
      } as Response);

    render(
      <OAuthServiceCard
        credKey="google-search-console"
        service={googleService}
        isConnected={false}
        onCredentialChange={onCredentialChange}
      />
    );

    fireEvent.click(await screen.findByRole("button", { name: "Or import from gws CLI" }));

    expect(
      await screen.findByText("Imported from gws CLI. Credentials are ready.")
    ).toBeInTheDocument();
    expect(onCredentialChange).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Connect with Google Search Console" }));
    expect(screen.queryByRole("button", { name: "Save & Continue" })).not.toBeInTheDocument();
  });

  it("keeps gws CLI import errors visible", async () => {
    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({ values: null }),
        ok: true,
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({ imported: false, error: "gws CLI not authenticated" }),
        ok: false,
      } as Response);

    render(
      <OAuthServiceCard
        credKey="google-search-console"
        service={googleService}
        isConnected={false}
        onCredentialChange={vi.fn()}
      />
    );

    fireEvent.click(await screen.findByRole("button", { name: "Or import from gws CLI" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("gws CLI not authenticated");
  });

  it("adds the desktop deep-link return scheme when connecting from Tauri", async () => {
    platformMock.isTauri = true;
    fetchMock.mockResolvedValue({
      json: async () => ({ values: null }),
      ok: true,
    } as Response);

    render(
      <OAuthServiceCard
        credKey="google-search-console"
        service={googleService}
        isConnected={false}
        onCredentialChange={vi.fn()}
      />
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Connect with Google Search Console" })
    );

    await waitFor(() => {
      expect(platformMock.invoke).toHaveBeenCalledWith("get_deep_link_scheme");
      expect(platformMock.openExternalUrl).toHaveBeenCalledTimes(1);
    });
    const url = new URL(platformMock.openExternalUrl.mock.calls[0][0]);
    expect(url.pathname).toBe("/api/auth/google/redirect");
    expect(url.searchParams.get("credKey")).toBe("google-search-console");
    expect(url.searchParams.get("desktopReturnScheme")).toBe("radarboard");
  });
});
