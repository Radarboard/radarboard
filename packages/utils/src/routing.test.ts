import type { RoutingConfig } from "@radarboard/types/database";
import type { NotificationRuleCondition } from "@radarboard/types/notifications";
import { describe, expect, it } from "vitest";
import {
  type RoutedEventInput,
  resolveRoutingSurfaceAccess,
  routingConditionMatches,
  routingRuleMatches,
} from "./routing";

const event: RoutedEventInput = {
  source: "github",
  type: "deployment.failed",
  severity: "critical",
  projectSlug: "radarboard",
  title: "Deploy failed",
  body: "Build timed out",
  metadata: {
    attempts: 3,
    acknowledged: false,
    environment: "production",
  },
};

describe("routing helpers", () => {
  it("matches number, boolean, and string conditions across event and metadata scopes", () => {
    const numericCondition: NotificationRuleCondition = {
      scope: "metadata",
      field: "attempts",
      operator: "greater_than_or_equal",
      valueType: "number",
      value: 3,
    };
    const booleanCondition: NotificationRuleCondition = {
      scope: "metadata",
      field: "acknowledged",
      operator: "equals",
      valueType: "boolean",
      value: false,
    };
    const stringCondition: NotificationRuleCondition = {
      scope: "event",
      field: "title",
      operator: "contains",
      valueType: "string",
      value: "deploy",
    };

    expect(routingConditionMatches(numericCondition, event)).toBe(true);
    expect(routingConditionMatches(booleanCondition, event)).toBe(true);
    expect(routingConditionMatches(stringCondition, event)).toBe(true);
  });

  it("matches rules and applies later allow or deny overrides per surface", () => {
    expect(
      routingRuleMatches(
        {
          id: "rule-1",
          name: "Critical deploys",
          enabled: true,
          source: "github",
          eventType: "deployment.*",
          severity: "warning",
          projectSlug: "radarboard",
          condition: null,
          createdAt: 0,
          updatedAt: 0,
          notifications: "allow",
          ticker: "deny",
        },
        event
      )
    ).toBe(true);

    const config: RoutingConfig = {
      rules: [
        {
          id: "rule-1",
          name: "Allow desktop for critical GitHub alerts",
          enabled: true,
          source: "github",
          eventType: "deployment.*",
          severity: "warning",
          projectSlug: "radarboard",
          condition: null,
          createdAt: 0,
          updatedAt: 0,
          notifications: "allow",
          ticker: "deny",
        },
        {
          id: "rule-2",
          name: "Block acknowledged events from desktop",
          enabled: true,
          source: "github",
          eventType: "deployment.*",
          severity: null,
          projectSlug: null,
          condition: {
            scope: "metadata",
            field: "acknowledged",
            operator: "equals",
            valueType: "boolean",
            value: false,
          },
          createdAt: 0,
          updatedAt: 0,
          notifications: "deny",
          ticker: "deny",
        },
      ],
    };

    expect(resolveRoutingSurfaceAccess("notifications", false, config, event)).toBe(false);
    expect(resolveRoutingSurfaceAccess("ticker", false, config, event)).toBe(false);
  });
});
