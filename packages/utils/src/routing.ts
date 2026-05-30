import type { RoutingConfig, RoutingRule, RoutingSurface } from "@radarboard/types/database";
import type {
  NotificationRuleCondition,
  NotificationSeverity,
} from "@radarboard/types/notifications";

export interface RoutedEventInput {
  source: string;
  type: string;
  severity: NotificationSeverity;
  projectSlug?: string | null;
  title?: string;
  body?: string | null;
  metadata?: Record<string, unknown>;
}

function escapeRegex(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function matchesGlob(value: string, pattern: string): boolean {
  if (pattern === "*") return true;
  const regex = new RegExp(`^${escapeRegex(pattern).replace(/\*/g, ".*")}$`);
  return regex.test(value);
}

function severityRank(severity: NotificationSeverity): number {
  switch (severity) {
    case "critical":
      return 3;
    case "warning":
      return 2;
    default:
      return 1;
  }
}

function eventFieldValue(event: RoutedEventInput, field: string): unknown {
  switch (field) {
    case "source":
      return event.source;
    case "type":
      return event.type;
    case "severity":
      return event.severity;
    case "projectSlug":
      return event.projectSlug ?? null;
    case "title":
      return event.title;
    case "body":
      return event.body ?? null;
    default:
      return undefined;
  }
}

function conditionValue(condition: NotificationRuleCondition, event: RoutedEventInput): unknown {
  if (condition.scope === "event") {
    return eventFieldValue(event, condition.field);
  }

  return event.metadata?.[condition.field];
}

export function routingConditionMatches(
  condition: NotificationRuleCondition,
  event: RoutedEventInput
): boolean {
  const actual = conditionValue(condition, event);
  if (actual === undefined || actual === null) return false;

  if (condition.valueType === "number") {
    const actualNumber = Number(actual);
    const expectedNumber = Number(condition.value);
    if (!Number.isFinite(actualNumber) || !Number.isFinite(expectedNumber)) return false;

    switch (condition.operator) {
      case "equals":
        return actualNumber === expectedNumber;
      case "not_equals":
        return actualNumber !== expectedNumber;
      case "greater_than":
        return actualNumber > expectedNumber;
      case "greater_than_or_equal":
        return actualNumber >= expectedNumber;
      case "less_than":
        return actualNumber < expectedNumber;
      case "less_than_or_equal":
        return actualNumber <= expectedNumber;
      case "contains":
        return String(actualNumber).includes(String(expectedNumber));
      default:
        return false;
    }
  }

  if (condition.valueType === "boolean") {
    const actualBoolean = actual === true || actual === "true";
    const expectedBoolean = condition.value === true || condition.value === "true";

    switch (condition.operator) {
      case "equals":
        return actualBoolean === expectedBoolean;
      case "not_equals":
        return actualBoolean !== expectedBoolean;
      default:
        return false;
    }
  }

  const actualString = String(actual).toLowerCase();
  const expectedString = String(condition.value).toLowerCase();

  switch (condition.operator) {
    case "equals":
      return actualString === expectedString;
    case "not_equals":
      return actualString !== expectedString;
    case "contains":
      return actualString.includes(expectedString);
    case "greater_than":
      return actualString > expectedString;
    case "greater_than_or_equal":
      return actualString >= expectedString;
    case "less_than":
      return actualString < expectedString;
    case "less_than_or_equal":
      return actualString <= expectedString;
    default:
      return false;
  }
}

export function routingRuleMatches(rule: RoutingRule, event: RoutedEventInput): boolean {
  if (!rule.enabled) return false;
  if (rule.source && rule.source !== event.source) return false;
  if (rule.eventType && !matchesGlob(event.type, rule.eventType)) return false;
  if (rule.projectSlug && rule.projectSlug !== (event.projectSlug ?? null)) return false;
  if (rule.severity && severityRank(event.severity) < severityRank(rule.severity)) return false;
  if (rule.condition && !routingConditionMatches(rule.condition, event)) return false;
  return true;
}

export function resolveRoutingSurfaceAccess(
  surface: RoutingSurface,
  baselineAllowed: boolean,
  config: RoutingConfig | null | undefined,
  event: RoutedEventInput
): boolean {
  let allowed = baselineAllowed;

  for (const rule of config?.rules ?? []) {
    if (!routingRuleMatches(rule, event)) continue;
    const action = rule[surface];
    if (action === "allow") {
      allowed = true;
    } else if (action === "deny") {
      allowed = false;
    }
  }

  return allowed;
}
