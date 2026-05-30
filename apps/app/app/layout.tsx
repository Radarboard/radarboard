import { OpenPanelComponent } from "@openpanel/nextjs";
import { TooltipProvider } from "@radarboard/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { NuqsAdapter } from "nuqs/adapters/next";
import type React from "react";
import { appFontVariables } from "@/app/fonts";
import { appMetadata, appViewport } from "@/app/metadata";
import { ThemeChrome } from "@/components/theme/theme-chrome";
import "./globals.css";

export const metadata = appMetadata;

export const viewport = appViewport;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${appFontVariables} overflow-hidden antialiased`}>
        {process.env.NEXT_PUBLIC_OPENPANEL_CLIENT_ID && (
          <OpenPanelComponent
            clientId={process.env.NEXT_PUBLIC_OPENPANEL_CLIENT_ID}
            trackScreenViews
            trackOutgoingLinks
            trackAttributes
          />
        )}
        <ThemeProvider attribute="class" defaultTheme="dark">
          <TooltipProvider delayDuration={300}>
            <NuqsAdapter>{children}</NuqsAdapter>
          </TooltipProvider>
          <ThemeChrome />
        </ThemeProvider>
      </body>
    </html>
  );
}
