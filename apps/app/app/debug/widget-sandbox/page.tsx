import { Suspense } from "react";
import { createPageMetadata } from "@/app/metadata";
import { WidgetSandbox } from "@/components/debug/widget-sandbox";

export const metadata = createPageMetadata({
  title: "Widget Sandbox",
});

export default function WidgetSandboxPage() {
  return (
    <Suspense fallback={null}>
      <WidgetSandbox />
    </Suspense>
  );
}
