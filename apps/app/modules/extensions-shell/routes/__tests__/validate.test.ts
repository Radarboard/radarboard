import { beforeEach, describe, expect, it, vi } from "vitest";

const parseGitHubUrlMock = vi.fn();
const validateGitHubExtensionMock = vi.fn();

vi.mock("@/lib/extension-installer/parse-github-url", () => ({
  parseGitHubUrl: (...args: unknown[]) => parseGitHubUrlMock(...args),
}));

vi.mock("@/lib/extension-installer/validate-package", () => ({
  validateGitHubExtension: (...args: unknown[]) => validateGitHubExtensionMock(...args),
}));

import { handleValidateExtension as POST } from "@/modules/extensions-shell/routes/validate";

beforeEach(() => {
  parseGitHubUrlMock.mockReset();
  validateGitHubExtensionMock.mockReset();
});

function makeRequest(payload: unknown): Request {
  return new Request("http://localhost/api/extensions/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

describe("POST /api/extensions/validate", () => {
  it("validates a valid GitHub URL", async () => {
    parseGitHubUrlMock.mockReturnValue({ owner: "acme", repo: "widget-foo" });
    validateGitHubExtensionMock.mockResolvedValue({
      valid: true,
      type: "widget",
      name: "widget-foo",
    });

    const res = await POST(makeRequest({ githubUrl: "https://github.com/acme/widget-foo" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.valid).toBe(true);
    expect(body.type).toBe("widget");
    expect(parseGitHubUrlMock).toHaveBeenCalledWith("https://github.com/acme/widget-foo");
    expect(validateGitHubExtensionMock).toHaveBeenCalledWith({
      owner: "acme",
      repo: "widget-foo",
    });
  });

  it("returns 400 when githubUrl is missing", async () => {
    const res = await POST(makeRequest({}));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("githubUrl is required");
  });

  it("returns 400 for an invalid GitHub URL", async () => {
    parseGitHubUrlMock.mockReturnValue(null);

    const res = await POST(makeRequest({ githubUrl: "https://gitlab.com/acme/repo" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Invalid GitHub URL/);
  });

  it("returns validation failure from validateGitHubExtension", async () => {
    parseGitHubUrlMock.mockReturnValue({ owner: "acme", repo: "bad-ext" });
    validateGitHubExtensionMock.mockResolvedValue({
      valid: false,
      errors: ["Missing package.json", "No radarboard config"],
    });

    const res = await POST(makeRequest({ githubUrl: "https://github.com/acme/bad-ext" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.valid).toBe(false);
    expect(body.errors).toContain("Missing package.json");
  });

  it("supports owner/repo shorthand format", async () => {
    parseGitHubUrlMock.mockReturnValue({ owner: "acme", repo: "my-plugin" });
    validateGitHubExtensionMock.mockResolvedValue({ valid: true, type: "plugin" });

    const res = await POST(makeRequest({ githubUrl: "acme/my-plugin" }));
    expect(res.status).toBe(200);
    expect(parseGitHubUrlMock).toHaveBeenCalledWith("acme/my-plugin");
  });
});
