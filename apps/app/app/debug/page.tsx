import { Suspense } from "react";
import { createPageMetadata } from "@/app/metadata";
import { DebugDashboard } from "@/components/debug/dashboard";

export const metadata = createPageMetadata({
  title: "Debug",
});

export default function DebugPage() {
  return (
    <Suspense fallback={null}>
      <DebugDashboard />
    </Suspense>
  );
}
