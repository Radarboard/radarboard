// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CredentialFields } from "../credential-fields";

describe("CredentialFields", () => {
  it("lets users show and hide password field values", async () => {
    const user = userEvent.setup();
    const onUpdateField = vi.fn();

    render(
      <CredentialFields
        credKey="vercel"
        fields={[
          { key: "token", label: "Access Token", type: "password" },
          { key: "teamId", label: "Team ID", type: "text" },
        ]}
        values={{ token: "secret-token", teamId: "team_123" }}
        onUpdateField={onUpdateField}
      />
    );

    const passwordInput = screen.getByLabelText("Access Token");
    expect(passwordInput).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Show Access Token" }));
    expect(passwordInput).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: "Hide Access Token" }));
    expect(passwordInput).toHaveAttribute("type", "password");
  });
});
