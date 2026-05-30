import { createPageMetadata } from "@/app/metadata";
import { TrayPanelPageClient } from "./tray-panel-page-client";

export const metadata = createPageMetadata({
  title: "Notifications Tray",
  description: "Compact Radarboard notifications tray panel.",
});

export default function TrayPanelPage() {
  return <TrayPanelPageClient />;
}
