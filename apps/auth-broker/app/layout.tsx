import type { ReactNode } from "react";

export const metadata = {
  title: "Radarboard Auth Broker",
};

// biome-ignore lint/style/noDefaultExport: Next.js App Router requires a default layout export.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
