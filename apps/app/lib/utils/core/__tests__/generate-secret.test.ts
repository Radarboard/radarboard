import { describe, expect, it } from "vitest";
import { generateSecret } from "../generate-secret";

describe("generateSecret", () => {
  it("returns a 24-byte hex secret by default", () => {
    const secret = generateSecret();

    expect(secret).toMatch(/^[a-f0-9]{48}$/);
  });

  it("supports custom byte lengths", () => {
    const secret = generateSecret(8);

    expect(secret).toMatch(/^[a-f0-9]{16}$/);
  });
});
