import { describe, expect, it } from "vitest";
import {
  resolveConnectServiceTarget,
  resolveProjectSettingsOpenState,
  resolveSettingsChildParamPreservation,
} from "../settings-params";

describe("resolveConnectServiceTarget", () => {
  it("detects chooser intents without treating them as project settings intents", () => {
    expect(resolveConnectServiceTarget("intent:analytics")).toEqual({
      integrationIntent: "analytics",
      isProjectSettingsIntent: false,
    });
  });

  it("detects project settings intents generically", () => {
    expect(resolveConnectServiceTarget("intent:openpanel-project")).toEqual({
      integrationIntent: "openpanel-project",
      isProjectSettingsIntent: true,
    });
    expect(resolveConnectServiceTarget("intent:google-search-console-project")).toEqual({
      integrationIntent: "google-search-console-project",
      isProjectSettingsIntent: true,
    });
  });

  it("treats concrete services as non-intent targets", () => {
    expect(resolveConnectServiceTarget("github")).toEqual({
      integrationIntent: null,
      isProjectSettingsIntent: false,
    });
  });
});

describe("resolveProjectSettingsOpenState", () => {
  it("preserves setup intent and keeps All Projects unselected", () => {
    expect(resolveProjectSettingsOpenState("intent:sponsorship-project", null)).toEqual({
      integrationIntent: "sponsorship-project",
      projectSlug: null,
    });
  });

  it("preserves the active project for project-mapping CTAs", () => {
    expect(resolveProjectSettingsOpenState("intent:openpanel-project", "radarboard")).toEqual({
      integrationIntent: "openpanel-project",
      projectSlug: "radarboard",
    });
  });

  it("ignores concrete service targets", () => {
    expect(resolveProjectSettingsOpenState("github", "radarboard")).toBeNull();
  });
});

describe("resolveSettingsChildParamPreservation", () => {
  it("preserves integration deep-link params when opening integrations", () => {
    expect(
      resolveSettingsChildParamPreservation("integrations", {
        integrationIntent: null,
        integrationTab: "events",
        service: "github",
      })
    ).toEqual({
      preserveIntegrationIntent: false,
      preserveIntegrationTab: true,
      preserveProject: false,
      preserveService: true,
    });
  });

  it("does not preserve integration params without a service deep link", () => {
    expect(
      resolveSettingsChildParamPreservation("integrations", {
        integrationIntent: null,
        integrationTab: "events",
        service: null,
      })
    ).toEqual({
      preserveIntegrationIntent: false,
      preserveIntegrationTab: false,
      preserveProject: false,
      preserveService: false,
    });
  });

  it("preserves integration intent when opening integrations from a chooser CTA", () => {
    expect(
      resolveSettingsChildParamPreservation("integrations", {
        integrationIntent: "analytics",
        integrationTab: null,
        service: null,
      })
    ).toEqual({
      preserveIntegrationIntent: true,
      preserveIntegrationTab: false,
      preserveProject: false,
      preserveService: false,
    });
  });

  it("preserves project setup params when opening projects from a project CTA", () => {
    expect(
      resolveSettingsChildParamPreservation("projects", {
        integrationIntent: "sponsorship-project",
        integrationTab: null,
        service: null,
      })
    ).toEqual({
      preserveIntegrationIntent: true,
      preserveIntegrationTab: false,
      preserveProject: true,
      preserveService: false,
    });
  });

  it("clears integration params for other settings sections", () => {
    expect(
      resolveSettingsChildParamPreservation("widgets", {
        integrationIntent: "analytics",
        integrationTab: "events",
        service: "github",
      })
    ).toEqual({
      preserveIntegrationIntent: false,
      preserveIntegrationTab: false,
      preserveProject: false,
      preserveService: false,
    });
  });
});
