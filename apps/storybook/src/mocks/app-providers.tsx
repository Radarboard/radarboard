import type { ReactNode } from "react";
import { StorybookAppProvider } from "./storybook-app-provider";

export function Providers({ children }: { children: ReactNode }) {
  return <StorybookAppProvider>{children}</StorybookAppProvider>;
}
