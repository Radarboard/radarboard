import { Suspense } from "react";
import { createPageMetadata } from "@/app/metadata";
import { PluginSandbox } from "@/components/debug/plugin-sandbox";

export const metadata = createPageMetadata({
  title: "Plugin Sandbox",
});

export default function PluginSandboxPage() {
  return (
    <Suspense fallback={null}>
      <PluginSandbox />
    </Suspense>
  );
}
