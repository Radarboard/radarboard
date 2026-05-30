import { afterEach, describe, expect, it } from "vitest";
import { getRelayEnv, getWebhookSecrets, RELAY_ENV_KEYS } from "../lib/env.js";

describe("getRelayEnv", () => {
  afterEach(() => {
    delete process.env.TEST_RELAY_VAR;
  });

  it("should return the value when the env var is set", () => {
    process.env.TEST_RELAY_VAR = "hello";
    expect(getRelayEnv("TEST_RELAY_VAR")).toBe("hello");
  });

  it("should return undefined when the env var is missing", () => {
    expect(getRelayEnv("NONEXISTENT_VAR_12345")).toBeUndefined();
  });

  it("should return undefined when the env var is empty string", () => {
    process.env.TEST_RELAY_VAR = "";
    expect(getRelayEnv("TEST_RELAY_VAR")).toBeUndefined();
  });
});

describe("getWebhookSecrets", () => {
  afterEach(() => {
    for (const key of Object.values(RELAY_ENV_KEYS.webhookSecrets)) {
      delete process.env[key];
    }
  });

  it("should return an array with a single secret", () => {
    process.env.WEBHOOK_SECRET_GITHUB = "my-secret";
    expect(getWebhookSecrets("github")).toEqual(["my-secret"]);
  });

  it("should return multiple secrets from comma-separated value", () => {
    process.env.WEBHOOK_SECRET_GITHUB = "new-secret,old-secret";
    expect(getWebhookSecrets("github")).toEqual(["new-secret", "old-secret"]);
  });

  it("should trim whitespace from secrets", () => {
    process.env.WEBHOOK_SECRET_GITHUB = " new-secret , old-secret ";
    expect(getWebhookSecrets("github")).toEqual(["new-secret", "old-secret"]);
  });

  it("should filter out empty entries from double commas", () => {
    process.env.WEBHOOK_SECRET_GITHUB = "secret1,,secret2";
    expect(getWebhookSecrets("github")).toEqual(["secret1", "secret2"]);
  });

  it("should return empty array for unknown integration", () => {
    expect(getWebhookSecrets("unknown-service")).toEqual([]);
  });

  it("should return empty array when env var is not set", () => {
    expect(getWebhookSecrets("github")).toEqual([]);
  });

  it("should work for all supported integrations", () => {
    process.env.WEBHOOK_SECRET_VERCEL = "v-secret";
    process.env.WEBHOOK_SECRET_SENTRY = "s-secret";
    process.env.WEBHOOK_SECRET_LINEAR = "l-secret";
    process.env.WEBHOOK_SECRET_BETTERSTACK = "b-secret";

    expect(getWebhookSecrets("vercel")).toEqual(["v-secret"]);
    expect(getWebhookSecrets("sentry")).toEqual(["s-secret"]);
    expect(getWebhookSecrets("linear")).toEqual(["l-secret"]);
    expect(getWebhookSecrets("betterstack")).toEqual(["b-secret"]);
  });
});

describe("RELAY_ENV_KEYS", () => {
  it("should have all expected key groups", () => {
    expect(RELAY_ENV_KEYS.redis).toBeDefined();
    expect(RELAY_ENV_KEYS.auth).toBeDefined();
    expect(RELAY_ENV_KEYS.sentry).toBeDefined();
    expect(RELAY_ENV_KEYS.cors).toBeDefined();
    expect(RELAY_ENV_KEYS.controls).toBeDefined();
    expect(RELAY_ENV_KEYS.webhookSecrets).toBeDefined();
  });

  it("should have all five integration secret keys", () => {
    expect(RELAY_ENV_KEYS.webhookSecrets.github).toBe("WEBHOOK_SECRET_GITHUB");
    expect(RELAY_ENV_KEYS.webhookSecrets.vercel).toBe("WEBHOOK_SECRET_VERCEL");
    expect(RELAY_ENV_KEYS.webhookSecrets.sentry).toBe("WEBHOOK_SECRET_SENTRY");
    expect(RELAY_ENV_KEYS.webhookSecrets.linear).toBe("WEBHOOK_SECRET_LINEAR");
    expect(RELAY_ENV_KEYS.webhookSecrets.betterstack).toBe("WEBHOOK_SECRET_BETTERSTACK");
  });
});
