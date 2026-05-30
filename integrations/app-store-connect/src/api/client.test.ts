import { generateKeyPairSync } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getAppInfo, getCustomerReviewSummarizations } from "./client";

describe("App Store Connect client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends an ES256 JWT with a raw 64-byte signature", async () => {
    const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: "123",
          attributes: {
            name: "Radarboard",
            bundleId: "com.example.radarboard",
            sku: "radarboard",
            primaryLocale: "en-US",
            contentRightsDeclaration: null,
          },
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    await getAppInfo(
      {
        keyId: "ABC123DEFG",
        issuerId: "dfa5dc5f-b51d-4f33-90f1-6440ac3e5c38",
        privateKey: privateKey.export({ format: "pem", type: "pkcs8" }).toString(),
      },
      "123"
    );

    expect(fetchMock).toHaveBeenCalledOnce();

    const [, init] = fetchMock.mock.calls[0] ?? [];
    const authorization = (init as RequestInit | undefined)?.headers
      ? (init?.headers as Record<string, string>).Authorization
      : undefined;

    expect(authorization).toMatch(/^Bearer /);

    const token = authorization?.slice("Bearer ".length);
    const [encodedHeader, encodedPayload, encodedSignature] = token?.split(".") ?? [];

    expect(encodedHeader).toBeTruthy();
    expect(encodedPayload).toBeTruthy();
    expect(encodedSignature).toBeTruthy();

    if (!encodedHeader || !encodedPayload || !encodedSignature) {
      throw new Error("Expected authorization token to contain header, payload, and signature");
    }

    const header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8")) as {
      alg: string;
      kid: string;
      typ: string;
    };
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as {
      aud: string;
      iss: string;
    };
    const signature = Buffer.from(encodedSignature, "base64url");

    expect(header).toMatchObject({ alg: "ES256", kid: "ABC123DEFG", typ: "JWT" });
    expect(payload).toMatchObject({
      aud: "appstoreconnect-v1",
      iss: "dfa5dc5f-b51d-4f33-90f1-6440ac3e5c38",
    });
    expect(signature).toHaveLength(64);
  });

  it("requests customer review summarizations with a platform filter", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    vi.stubGlobal("fetch", fetchMock);

    await getCustomerReviewSummarizations(
      {
        keyId: "ABC123DEFG",
        issuerId: "dfa5dc5f-b51d-4f33-90f1-6440ac3e5c38",
        privateKey: generateKeyPairSync("ec", { namedCurve: "prime256v1" })
          .privateKey.export({ format: "pem", type: "pkcs8" })
          .toString(),
      },
      "123",
      { platform: "IOS", limit: 1 }
    );

    expect(fetchMock).toHaveBeenCalledOnce();

    const [requestUrl] = fetchMock.mock.calls[0] ?? [];
    const url = String(requestUrl);

    expect(url).toContain("/v1/apps/123/customerReviewSummarizations?");
    expect(url).toContain("filter%5Bplatform%5D=IOS");
    expect(url).toContain("limit=1");
  });
});
