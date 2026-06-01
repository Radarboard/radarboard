import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleTestCredentials } from "../test";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

function makeRequest(payload: unknown): Request {
  return new Request("http://localhost/api/credentials/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

describe("handleTestCredentials", () => {
  it("returns 400 when key is missing", async () => {
    const res = await handleTestCredentials(makeRequest({ values: { token: "abc" } }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/Missing/);
  });

  it("returns 400 when values are missing", async () => {
    const res = await handleTestCredentials(makeRequest({ key: "sentry" }));
    expect(res.status).toBe(400);
  });

  it("returns error for unknown service", async () => {
    const res = await handleTestCredentials(
      makeRequest({ key: "unknown-service", values: { token: "abc" } })
    );
    const body = await res.json();

    expect(body.ok).toBe(false);
    expect(body.error).toContain("No test available");
    expect(body.error).toContain("unknown-service");
  });

  describe("sentry", () => {
    it("returns ok on successful API call", async () => {
      fetchMock.mockResolvedValue({ ok: true, status: 200 });

      const res = await handleTestCredentials(
        makeRequest({
          key: "sentry",
          values: { authToken: "sntrys_abc", orgSlug: "my-org" },
        })
      );
      const body = await res.json();

      expect(body.ok).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        "https://sentry.io/api/0/organizations/my-org/",
        expect.objectContaining({ headers: expect.any(Headers) })
      );
    });

    it("returns error on failed API call", async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 401 });

      const res = await handleTestCredentials(
        makeRequest({
          key: "sentry",
          values: { authToken: "bad", orgSlug: "org" },
        })
      );
      const body = await res.json();

      expect(body.ok).toBe(false);
      expect(body.error).toContain("401");
    });
  });

  describe("openpanel", () => {
    it("uses the current manage projects endpoint", async () => {
      fetchMock.mockResolvedValue({ ok: true, status: 200 });

      const res = await handleTestCredentials(
        makeRequest({
          key: "openpanel",
          values: { clientId: "client-id", clientSecret: "client-secret" },
        })
      );
      const body = await res.json();

      expect(body.ok).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.openpanel.dev/manage/projects",
        expect.objectContaining({
          headers: {
            "openpanel-client-id": "client-id",
            "openpanel-client-secret": "client-secret",
          },
        })
      );
    });

    it("shows a root-client hint when OpenPanel returns 401", async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 401 });

      const res = await handleTestCredentials(
        makeRequest({
          key: "openpanel",
          values: { clientId: "client-id", clientSecret: "client-secret" },
        })
      );
      const body = await res.json();

      expect(body.ok).toBe(false);
      expect(body.error).toContain("root client");
    });
  });

  describe("raindrop", () => {
    it("normalizes a pasted bearer header value before testing", async () => {
      fetchMock.mockResolvedValue({ ok: true, status: 200 });

      const res = await handleTestCredentials(
        makeRequest({
          key: "raindrop",
          values: { accessToken: " Bearer rd_test_token " },
        })
      );
      const body = await res.json();
      const requestInit = fetchMock.mock.calls[0]?.[1] as { headers: Headers };

      expect(body.ok).toBe(true);
      expect(requestInit.headers.get("Authorization")).toBe("Bearer rd_test_token");
    });

    it("returns a token-specific hint when Raindrop returns 401", async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 401 });

      const res = await handleTestCredentials(
        makeRequest({
          key: "raindrop",
          values: { accessToken: "bad-token" },
        })
      );
      const body = await res.json();

      expect(body.ok).toBe(false);
      expect(body.error).toContain("Raindrop returned 401");
      expect(body.error).toContain("Test token");
      expect(body.error).toContain("expired OAuth tokens");
    });

    it("rejects an empty Raindrop token without calling the API", async () => {
      const res = await handleTestCredentials(
        makeRequest({
          key: "raindrop",
          values: { accessToken: " " },
        })
      );
      const body = await res.json();

      expect(body.ok).toBe(false);
      expect(body.error).toContain("access token");
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("revenuecat", () => {
    it("checks documented overview and chart endpoints", async () => {
      fetchMock.mockResolvedValue({ ok: true, status: 200 });

      const res = await handleTestCredentials(
        makeRequest({
          key: "revenuecat",
          values: { apiKey: "sk_test", projectId: "proj1ab2c3d4" },
        })
      );
      const body = await res.json();

      expect(body.ok).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        "https://api.revenuecat.com/v2/projects/proj1ab2c3d4/metrics/overview?currency=USD",
        expect.objectContaining({ headers: expect.any(Headers) })
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        "https://api.revenuecat.com/v2/projects/proj1ab2c3d4/charts/revenue?currency=USD&resolution=0",
        expect.objectContaining({ headers: expect.any(Headers) })
      );
    });

    it("rejects public SDK keys with a secret-key hint", async () => {
      const res = await handleTestCredentials(
        makeRequest({
          key: "revenuecat",
          values: { apiKey: "appl_public", projectId: "proj1ab2c3d4" },
        })
      );
      const body = await res.json();

      expect(body.ok).toBe(false);
      expect(body.error).toContain("public SDK keys");
      expect(body.error).toContain("sk_");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns a project-id hint when RevenueCat returns 404 for an app-shaped id", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 404,
        json: vi.fn().mockResolvedValue({ message: "Not found" }),
      });

      const res = await handleTestCredentials(
        makeRequest({
          key: "revenuecat",
          values: { apiKey: "sk_test", projectId: "app62917b086a" },
        })
      );
      const body = await res.json();

      expect(body.ok).toBe(false);
      expect(body.error).toContain("Project ID");
      expect(body.error).toContain("App ID");
    });

    it("explains missing overview permission", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 403,
        json: vi.fn().mockResolvedValue({ message: "Missing permission" }),
      });

      const res = await handleTestCredentials(
        makeRequest({
          key: "revenuecat",
          values: { apiKey: "sk_test", projectId: "proj1ab2c3d4" },
        })
      );
      const body = await res.json();

      expect(body.ok).toBe(false);
      expect(body.error).toContain("Overview Configuration");
      expect(body.error).toContain("Read");
    });

    it("explains missing chart permission", async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, status: 200 }).mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: vi.fn().mockResolvedValue({ message: "Missing permission" }),
      });

      const res = await handleTestCredentials(
        makeRequest({
          key: "revenuecat",
          values: { apiKey: "sk_test", projectId: "proj1ab2c3d4" },
        })
      );
      const body = await res.json();

      expect(body.ok).toBe(false);
      expect(body.error).toContain("Charts Configuration");
      expect(body.error).toContain("Read");
    });
  });

  describe("npm", () => {
    it("requires extraPackages to be non-empty", async () => {
      const res = await handleTestCredentials(
        makeRequest({
          key: "npm",
          values: { scope: "@my-org", extraPackages: "" },
        })
      );
      const body = await res.json();

      expect(body.ok).toBe(false);
      expect(body.error).toContain("package");
    });

    it("returns ok when extraPackages is provided", async () => {
      const res = await handleTestCredentials(
        makeRequest({
          key: "npm",
          values: { scope: "@my-org", extraPackages: "lodash" },
        })
      );
      const body = await res.json();

      expect(body.ok).toBe(true);
    });
  });

  describe("app-store-connect", () => {
    it("always returns ok (no remote check)", async () => {
      const res = await handleTestCredentials(
        makeRequest({
          key: "app-store-connect",
          values: { keyId: "abc" },
        })
      );
      const body = await res.json();

      expect(body.ok).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("vercel", () => {
    it("includes teamId in URL when provided", async () => {
      fetchMock.mockResolvedValue({ ok: true });

      await handleTestCredentials(
        makeRequest({
          key: "vercel",
          values: { token: "tkn", teamId: "team_123" },
        })
      );

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("teamId=team_123"),
        expect.any(Object)
      );
    });

    it("omits teamId from URL when not provided", async () => {
      fetchMock.mockResolvedValue({ ok: true });

      await handleTestCredentials(
        makeRequest({
          key: "vercel",
          values: { token: "tkn" },
        })
      );

      expect(fetchMock).toHaveBeenCalledWith(
        expect.not.stringContaining("teamId"),
        expect.any(Object)
      );
    });
  });

  describe("error handling", () => {
    it("catches fetch errors gracefully", async () => {
      fetchMock.mockRejectedValue(new Error("Network error"));

      const res = await handleTestCredentials(
        makeRequest({
          key: "sentry",
          values: { authToken: "abc", orgSlug: "org" },
        })
      );
      const body = await res.json();

      expect(body.ok).toBe(false);
      expect(body.error).toBe("Network error");
    });

    it("catches non-Error exceptions", async () => {
      fetchMock.mockRejectedValue("string error");

      const res = await handleTestCredentials(
        makeRequest({
          key: "linear",
          values: { apiKey: "abc" },
        })
      );
      const body = await res.json();

      expect(body.ok).toBe(false);
      expect(body.error).toBe("Connection test failed");
    });
  });
});
