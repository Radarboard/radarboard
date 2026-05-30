import { describe, expect, it } from "vitest";
import { extractBearerToken, validateToken } from "./auth";

describe("MCP auth helpers", () => {
  it("extracts bearer tokens and trims incidental whitespace", () => {
    expect(extractBearerToken("Bearer sk-test-token   ")).toBe("sk-test-token");
    expect(extractBearerToken("bearer another-token")).toBe("another-token");
    expect(extractBearerToken(null)).toBeNull();
  });

  it("validates only exact non-empty token matches", () => {
    expect(validateToken("token-a", "token-a")).toBe(true);
    expect(validateToken("token-a", "token-b")).toBe(false);
    expect(validateToken("", "token-a")).toBe(false);
  });
});
