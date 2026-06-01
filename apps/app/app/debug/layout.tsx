import { type ReactNode, Suspense } from "react";
import { DebugShell } from "@/components/debug/shell";

export default function DebugLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <DebugShell>{children}</DebugShell>
    </Suspense>
  );
}
