import { Suspense } from "react";
import { createPageMetadata } from "@/app/metadata";
import { IntegrationSandbox } from "@/components/debug/integration-sandbox";

export const metadata = createPageMetadata({
  title: "Integration Sandbox",
});

export default function IntegrationSandboxPage() {
  return (
    <Suspense fallback={null}>
      <IntegrationSandbox />
    </Suspense>
  );
}
