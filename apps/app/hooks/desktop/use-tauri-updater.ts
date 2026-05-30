"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  checkForDesktopUpdate,
  getDesktopAppInfo,
  installDesktopUpdate,
  isDesktopRuntime,
} from "@/lib/tauri-updater";

const UPDATE_TOAST_ID = "desktop-updater";

function formatReleaseNotes(body?: string) {
  if (!body) return "A newer Radarboard Desktop version is available.";
  const trimmed = body.trim();
  if (!trimmed) return "A newer Radarboard Desktop version is available.";
  return trimmed.length > 240 ? `${trimmed.slice(0, 237)}...` : trimmed;
}

export function useTauriUpdater() {
  const checkedOnStartupRef = useRef(false);
  const activeVersionRef = useRef<string | null>(null);
  const installInProgressRef = useRef(false);

  useEffect(() => {
    if (!isDesktopRuntime()) {
      return;
    }

    let disposed = false;
    let unlisten: (() => void) | null = null;

    const installUpdate = async () => {
      if (installInProgressRef.current) {
        return;
      }

      installInProgressRef.current = true;
      toast.loading("Downloading update…", {
        id: UPDATE_TOAST_ID,
        description: "Preparing the latest Radarboard Desktop build.",
      });

      try {
        const update = await checkForDesktopUpdate();
        if (!update) {
          toast.success("Radarboard is already up to date.", { id: UPDATE_TOAST_ID });
          return;
        }

        await installDesktopUpdate(update, (event) => {
          if (event.event === "Started") {
            toast.loading("Downloading update…", {
              id: UPDATE_TOAST_ID,
              description: `Installing Radarboard ${update.version}.`,
            });
            return;
          }

          if (event.event === "Progress") {
            toast.loading("Downloading update…", {
              id: UPDATE_TOAST_ID,
              description: `${Math.round(event.data.chunkLength / 1024)} KB received…`,
            });
            return;
          }

          if (event.event === "Finished") {
            toast.loading("Installing update…", {
              id: UPDATE_TOAST_ID,
              description: `Restarting into Radarboard ${update.version}.`,
            });
          }
        });

        toast.success("Update installed. Restarting Radarboard…", {
          id: UPDATE_TOAST_ID,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        toast.error("Update installation failed", {
          id: UPDATE_TOAST_ID,
          description: message,
        });
      } finally {
        installInProgressRef.current = false;
      }
    };

    const showNoUpdateToast = (silentNoUpdate: boolean) => {
      if (!silentNoUpdate) {
        toast.success("Radarboard is already up to date.", { id: UPDATE_TOAST_ID });
      }
    };

    const showUpdateErrorToast = (error: unknown, silentNoUpdate: boolean) => {
      if (!silentNoUpdate) {
        const message = error instanceof Error ? error.message : String(error);
        toast.error("Update check failed", {
          id: UPDATE_TOAST_ID,
          description: message,
        });
      }
    };

    const showAvailableUpdateToast = (version: string, body?: string) => {
      toast.info(`Radarboard ${version} is available`, {
        id: UPDATE_TOAST_ID,
        duration: Infinity,
        description: formatReleaseNotes(body),
        action: {
          label: "Install & Restart",
          onClick: () => {
            installUpdate().catch(() => {
              // installUpdate already reports user-facing errors
            });
          },
        },
        cancel: {
          label: "Later",
          onClick: () => {
            toast.dismiss(UPDATE_TOAST_ID);
          },
        },
      });
    };

    const runCheck = async ({
      silentNoUpdate,
      force,
    }: {
      silentNoUpdate: boolean;
      force?: boolean;
    }) => {
      try {
        const update = await checkForDesktopUpdate();

        if (!update) {
          showNoUpdateToast(silentNoUpdate);
          return;
        }

        if (!force && activeVersionRef.current === update.version) {
          return;
        }

        activeVersionRef.current = update.version;
        showAvailableUpdateToast(update.version, update.body);
      } catch (error) {
        showUpdateErrorToast(error, silentNoUpdate);
      }
    };

    const setup = async () => {
      const appInfo = await getDesktopAppInfo();
      if (disposed || !appInfo.updaterEnabled) {
        return;
      }

      const { listen } = await import("@tauri-apps/api/event");

      unlisten = await listen("check-for-updates", () => {
        runCheck({ silentNoUpdate: false, force: true }).catch(() => {
          // runCheck already reports user-facing errors for manual checks
        });
      });

      if (!checkedOnStartupRef.current) {
        checkedOnStartupRef.current = true;
        window.setTimeout(() => {
          if (!disposed) {
            runCheck({ silentNoUpdate: true }).catch(() => {
              // startup checks are intentionally silent on failure
            });
          }
        }, 4000);
      }
    };

    setup().catch(() => {
      // updater setup should never break app startup
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);
}
