// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiCredentialAccessCard } from "../api-access";

const saveCredentialValuesMock = vi.fn();
const mutateSWRMock = vi.fn();

vi.mock("swr", () => ({
  mutate: (...args: unknown[]) => mutateSWRMock(...args),
}));

vi.mock("@/components/settings/settings-integrations/utils", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/settings/settings-integrations/utils")>();
  return {
    ...actual,
    saveCredentialValues: (...args: unknown[]) => saveCredentialValuesMock(...args),
  };
});

const service = {
  credKey: "openpanel",
  auth: {
    name: "OpenPanel",
    type: "api_key",
    fields: [
      { key: "clientId", label: "Client ID", type: "text" },
      { key: "clientSecret", label: "Client Secret", type: "password" },
    ],
  },
  pollingSourceIds: [],
  usedByWidgets: [],
};

describe("ApiCredentialAccessCard", () => {
  beforeEach(() => {
    saveCredentialValuesMock.mockReset();
    mutateSWRMock.mockReset();
  });

  it("shows a success confirmation after saving credentials", async () => {
    saveCredentialValuesMock.mockResolvedValue(true);
    const onCredentialChange = vi.fn();
    const user = userEvent.setup();

    render(
      <ApiCredentialAccessCard
        service={service}
        credentialKey="openpanel"
        values={{ clientId: "cid", clientSecret: "secret" }}
        setValues={() => {}}
        onCredentialChange={onCredentialChange}
      />
    );

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByText("Credentials saved")).toBeInTheDocument();
      expect(onCredentialChange).toHaveBeenCalledTimes(1);
    });
  });

  it("revalidates integration widget data after saving credentials", async () => {
    saveCredentialValuesMock.mockResolvedValue(true);
    mutateSWRMock.mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <ApiCredentialAccessCard
        service={{
          ...service,
          credKey: "revenuecat",
          auth: {
            name: "RevenueCat",
            type: "api_key",
            fields: [
              { key: "apiKey", label: "API Secret Key", type: "password" },
              { key: "projectId", label: "Project ID", type: "text" },
            ],
          },
        }}
        credentialKey="revenuecat"
        values={{ apiKey: "sk_test", projectId: "proj1ab2c3d4" }}
        setValues={() => {}}
        onCredentialChange={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mutateSWRMock).toHaveBeenCalledWith(expect.any(Function), undefined, {
        revalidate: true,
      });
    });

    const matcher = mutateSWRMock.mock.calls[0]?.[0] as (key: unknown) => boolean;
    expect(matcher("/api/integrations/revenuecat/data?range=30d")).toBe(true);
    expect(matcher("/api/integrations/openpanel/data?range=30d")).toBe(true);
    expect(matcher("/api/analytics/data?range=30d")).toBe(true);
    expect(matcher("/api/credentials")).toBe(false);
  });
});
