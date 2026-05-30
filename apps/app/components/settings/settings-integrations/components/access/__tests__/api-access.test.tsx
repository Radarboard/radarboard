// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiCredentialAccessCard } from "../api-access";

const saveCredentialValuesMock = vi.fn();

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
});
