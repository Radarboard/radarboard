// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import {
  getEnabledModelsForProvider,
  readEnabledModels,
  writeEnabledModels,
} from "./model-preferences";

describe("model preferences", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("reads and writes enabled models by provider", () => {
    writeEnabledModels({
      openai: ["gpt-4o", "gpt-4.1-mini"],
      anthropic: ["claude-sonnet-4-6"],
    });

    expect(readEnabledModels()).toEqual({
      openai: ["gpt-4o", "gpt-4.1-mini"],
      anthropic: ["claude-sonnet-4-6"],
    });
    expect(getEnabledModelsForProvider("openai")).toEqual(["gpt-4o", "gpt-4.1-mini"]);
    expect(getEnabledModelsForProvider("google")).toBeNull();
  });

  it("returns null for missing or invalid stored data", () => {
    expect(readEnabledModels()).toBeNull();

    window.localStorage.setItem("radarboard:enabled-models", "{broken-json");
    expect(readEnabledModels()).toBeNull();
  });
});
