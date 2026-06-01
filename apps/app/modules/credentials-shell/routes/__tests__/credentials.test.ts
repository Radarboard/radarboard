import { beforeEach, describe, expect, it, vi } from "vitest";

const credentialRepoMock = {
  setCredential: vi.fn(),
  getCredential: vi.fn(),
  deleteCredential: vi.fn(),
  listCredentialKeys: vi.fn(),
};
const cacheRepoMock = {
  getKeysByRoute: vi.fn(),
  delete: vi.fn(),
};

vi.mock("@/db/repository", () => ({
  getCredentialRepo: () => credentialRepoMock,
  getCacheRepo: () => cacheRepoMock,
}));

import { handleSaveCredentials } from "../credentials";

function makeRequest(payload: unknown): Request {
  return new Request("http://localhost/api/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

describe("credentials route", () => {
  beforeEach(() => {
    credentialRepoMock.setCredential.mockReset();
    credentialRepoMock.getCredential.mockReset();
    credentialRepoMock.deleteCredential.mockReset();
    credentialRepoMock.listCredentialKeys.mockReset();
    cacheRepoMock.getKeysByRoute.mockReset();
    cacheRepoMock.delete.mockReset();
  });

  it("invalidates registered integration data-source caches for the saved credential key", async () => {
    credentialRepoMock.setCredential.mockResolvedValue(undefined);
    cacheRepoMock.getKeysByRoute.mockResolvedValue(["revenue:all:30d:USD:UTC"]);
    cacheRepoMock.delete.mockResolvedValue(undefined);

    const res = await handleSaveCredentials(
      makeRequest({
        key: "revenuecat",
        values: { apiKey: "sk_test", projectId: "proj1ab2c3d4" },
      })
    );

    expect(res.status).toBe(200);
    expect(cacheRepoMock.getKeysByRoute).toHaveBeenCalledWith("/api/integrations/revenuecat/data");
    expect(cacheRepoMock.delete).toHaveBeenCalledWith("revenue:all:30d:USD:UTC");
  });
});
