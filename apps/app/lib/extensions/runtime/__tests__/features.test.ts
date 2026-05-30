import { beforeEach, describe, expect, it, vi } from "vitest";

const getWebEnvMock = vi.fn();

vi.mock("@/lib/env", () => ({
  getWebEnv: (...args: unknown[]) => getWebEnvMock(...args),
}));

// Mock the feature SDK functions
vi.mock("@radarboard/feature-sdk/registry", () => ({
  registerFeature: vi.fn(),
}));

vi.mock("@radarboard/feature-sdk/resolution", () => ({
  resolveFeatureEnabled: vi.fn().mockReturnValue(true),
  isFeaturePlanLocked: vi.fn().mockReturnValue(false),
  listFeatures: vi.fn().mockReturnValue([]),
  listUserFeatures: vi.fn().mockReturnValue([]),
  getDisabledSettingsSections: vi.fn().mockReturnValue([]),
  getDisabledToolNames: vi.fn().mockReturnValue(new Set()),
}));

vi.mock("./features-init", () => ({
  featureDescriptors: [
    {
      id: "assistant",
      envKey: "NEXT_PUBLIC_FEATURE_ASSISTANT",
      label: "Assistant",
      description: "AI assistant",
      defaultEnabled: true,
      tier: "user",
      plan: "free",
    },
    {
      id: "notifications",
      envKey: "NEXT_PUBLIC_FEATURE_NOTIFICATIONS",
      label: "Notifications",
      description: "Event notifications",
      defaultEnabled: true,
      tier: "user",
      plan: "free",
    },
  ],
  registerFeatures: vi.fn(),
}));

import { featureNotFound, getDefaultPlan, isFeatureEnabled } from "../features";

beforeEach(() => {
  getWebEnvMock.mockReset();
});

describe("isFeatureEnabled", () => {
  it("returns true when env var is not set (default enabled)", () => {
    getWebEnvMock.mockReturnValue(undefined);
    expect(isFeatureEnabled("assistant")).toBe(true);
  });

  it("returns true when env var is '1'", () => {
    getWebEnvMock.mockReturnValue("1");
    expect(isFeatureEnabled("assistant")).toBe(true);
  });

  it("returns true when env var is 'true'", () => {
    getWebEnvMock.mockReturnValue("true");
    expect(isFeatureEnabled("assistant")).toBe(true);
  });

  it("returns false when env var is '0'", () => {
    getWebEnvMock.mockReturnValue("0");
    expect(isFeatureEnabled("assistant")).toBe(false);
  });

  it("returns false when env var is 'false'", () => {
    getWebEnvMock.mockReturnValue("false");
    expect(isFeatureEnabled("assistant")).toBe(false);
  });

  it("returns true for unknown feature IDs (no env key mapped)", () => {
    // Unknown features have no envKey, so they default to enabled
    expect(isFeatureEnabled("nonexistent" as any)).toBe(true);
  });
});

describe("featureNotFound", () => {
  it("returns a 404 response", () => {
    const res = featureNotFound();
    expect(res.status).toBe(404);
  });
});

describe("getDefaultPlan", () => {
  it("returns 'free' when env var is not set", () => {
    delete process.env.NEXT_PUBLIC_RADARBOARD_PLAN;
    expect(getDefaultPlan()).toBe("free");
  });

  it("returns 'pro' when env var is 'pro'", () => {
    process.env.NEXT_PUBLIC_RADARBOARD_PLAN = "pro";
    expect(getDefaultPlan()).toBe("pro");
  });

  it("returns 'enterprise' when env var is 'enterprise'", () => {
    process.env.NEXT_PUBLIC_RADARBOARD_PLAN = "enterprise";
    expect(getDefaultPlan()).toBe("enterprise");
  });

  it("returns 'free' for invalid plan values", () => {
    process.env.NEXT_PUBLIC_RADARBOARD_PLAN = "ultimate";
    expect(getDefaultPlan()).toBe("free");
  });
});
