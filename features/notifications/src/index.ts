import type { FeatureDescriptor } from "@radarboard/feature-sdk/types";
export { NotificationCenterView } from "./components/notification-center-view";
export { NotificationDropdown } from "./components/notification-dropdown";
export { NotificationItem } from "./components/notification-item";
export { NotificationPanel } from "./components/notification-panel";
export { groupNotifications, type NotificationGroup } from "./utils/notification-grouping";

export const notificationsDescriptor: FeatureDescriptor = {
  id: "notifications",
  envKey: "NEXT_PUBLIC_FEATURE_NOTIFICATIONS",
  label: "Notifications",
  description: "Event notifications and digest delivery.",
  defaultEnabled: true,
  tier: "user",
  plan: "free",
  category: "infrastructure",
  settingsSections: ["notifications"],
};
