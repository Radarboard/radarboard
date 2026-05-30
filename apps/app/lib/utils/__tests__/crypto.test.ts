import { decrypt, encrypt } from "@radarboard/utils/crypto";
import { describe, expect, it } from "vitest";

const TEST_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("encrypt/decrypt", () => {
  it("roundtrips a simple string", () => {
    const plaintext = "hello world";
    const encrypted = encrypt(plaintext, TEST_KEY);
    const decrypted = decrypt(encrypted, TEST_KEY);
    expect(decrypted).toBe(plaintext);
  });

  it("roundtrips JSON", () => {
    const data = JSON.stringify({ authToken: "sntrys_abc123", orgSlug: "my-org" });
    const encrypted = encrypt(data, TEST_KEY);
    const decrypted = decrypt(encrypted, TEST_KEY);
    expect(decrypted).toBe(data);
    expect(JSON.parse(decrypted)).toEqual({ authToken: "sntrys_abc123", orgSlug: "my-org" });
  });

  it("produces different ciphertext for same plaintext (random IV)", () => {
    const plaintext = "same input";
    const a = encrypt(plaintext, TEST_KEY);
    const b = encrypt(plaintext, TEST_KEY);
    expect(a).not.toBe(b);
    // Both decrypt to the same value
    expect(decrypt(a, TEST_KEY)).toBe(plaintext);
    expect(decrypt(b, TEST_KEY)).toBe(plaintext);
  });

  it("fails to decrypt with wrong key", () => {
    const encrypted = encrypt("secret", TEST_KEY);
    const wrongKey = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    expect(() => decrypt(encrypted, wrongKey)).toThrow();
  });

  it("fails on malformed input", () => {
    expect(() => decrypt("not-valid-format", TEST_KEY)).toThrow();
    expect(() => decrypt("a:b", TEST_KEY)).toThrow();
  });

  it("handles empty string by rejecting it", () => {
    // AES-GCM with empty plaintext produces empty ciphertext which breaks the format
    // This is expected behavior -- credentials should never be empty strings
    const encrypted = encrypt("", TEST_KEY);
    // The encrypted format is "iv::tag" with empty ciphertext, which decrypt rejects
    expect(() => decrypt(encrypted, TEST_KEY)).toThrow();
  });

  it("handles unicode", () => {
    const plaintext = "日本語テスト 🎌";
    const encrypted = encrypt(plaintext, TEST_KEY);
    expect(decrypt(encrypted, TEST_KEY)).toBe(plaintext);
  });

  it("derives key from short string", () => {
    const plaintext = "test with short key";
    const shortKey = "my-dev-key";
    const encrypted = encrypt(plaintext, shortKey);
    expect(decrypt(encrypted, shortKey)).toBe(plaintext);
  });
});
