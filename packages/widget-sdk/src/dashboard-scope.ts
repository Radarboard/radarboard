import type { WidgetDescriptor } from "./widget-types";

/**
 * Dashboard scopes that determine whether a widget can be placed on the
 * global all-projects dashboard, an individual project dashboard, or both.
 */
export const DASHBOARD_SCOPES = ["all-projects", "project"] as const;

/** Supported placement scope for a widget descriptor. */
export type DashboardScope = (typeof DASHBOARD_SCOPES)[number];

const DEFAULT_DASHBOARD_SCOPES: readonly DashboardScope[] = DASHBOARD_SCOPES;

/**
 * Returns the dashboard scopes supported by a widget, defaulting to every
 * current scope when the descriptor has not opted into a narrower placement.
 */
export function getWidgetSupportedScopes(
  descriptor: Pick<WidgetDescriptor, "supportedDashboardScopes">
): readonly DashboardScope[] {
  return descriptor.supportedDashboardScopes ?? DEFAULT_DASHBOARD_SCOPES;
}

/** Returns whether a widget descriptor can be placed in the requested scope. */
export function canPlaceWidgetInScope(
  descriptor: Pick<WidgetDescriptor, "supportedDashboardScopes">,
  scope: DashboardScope
): boolean {
  return getWidgetSupportedScopes(descriptor).includes(scope);
}

/** Filters widget descriptors to those valid for the requested dashboard scope. */
export function filterWidgetsForDashboardScope<
  TWidget extends Pick<WidgetDescriptor, "supportedDashboardScopes">,
>(widgets: readonly TWidget[], scope: DashboardScope): TWidget[] {
  return widgets.filter((widget) => canPlaceWidgetInScope(widget, scope));
}
