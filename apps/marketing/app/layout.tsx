import { OpenPanelComponent } from "@openpanel/nextjs";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import type React from "react";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { site } from "@/data/site";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `${site.name} — ${site.tagline}`,
    template: `%s — ${site.name}`,
  },
  description: site.description,
  icons: [{ rel: "icon", url: "/favicon.svg", type: "image/svg+xml" }],
};

/* biome-ignore lint/style/noProcessEnv: marketing analytics client id is provided by Next.js at build time. */
const openPanelClientId = process.env.NEXT_PUBLIC_OPENPANEL_MARKETING_CLIENT_ID;

/* biome-ignore lint/style/noDefaultExport: Next.js app layouts require a default export. */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} min-h-screen overflow-x-hidden bg-background text-foreground selection:bg-accent selection:text-background`}
      >
        {openPanelClientId ? (
          <OpenPanelComponent
            clientId={openPanelClientId}
            trackScreenViews
            trackOutgoingLinks
            trackAttributes
          />
        ) : null}
        <Header />
        <main>{children}</main>
        <div className="mt-24" />
        <Footer />
      </body>
    </html>
  );
}
