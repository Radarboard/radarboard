import { describe, expect, it } from "vitest";
import { decrypt, encrypt } from "./crypto";

describe("crypto helpers", () => {
  it("round-trips plaintext with hashed or hex keys", () => {
    const plaintext = "super-secret";

    const hashedKeyEncrypted = encrypt(plaintext, "my-key");
    const hexKeyEncrypted = encrypt(
      plaintext,
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    );

    expect(decrypt(hashedKeyEncrypted, "my-key")).toBe(plaintext);
    expect(
      decrypt(hexKeyEncrypted, "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
    ).toBe(plaintext);
  });

  it("rejects malformed encrypted payloads", () => {
    expect(() => decrypt("missing-separators", "my-key")).toThrowError(
      "Invalid encrypted data format"
    );
  });
});
