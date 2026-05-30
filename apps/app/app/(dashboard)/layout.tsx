import type { ReactNode } from "react";
import { Dashboard } from "@/components/dashboard/dashboard";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Dashboard />
      {children}
    </>
  );
}
