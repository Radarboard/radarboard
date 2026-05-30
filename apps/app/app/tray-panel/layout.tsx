import "../globals.css";

/**
 * Minimal layout for the tray notification panel popover.
 * No app shell, no sidebar, no providers — just the panel content
 * with a transparent background for the native popover effect.
 */
export default function TrayPanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="overflow-hidden bg-transparent">{children}</body>
    </html>
  );
}
