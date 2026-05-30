"use client";

import { Button } from "@radarboard/ui/button";
import { EmptyState } from "@radarboard/ui/empty-state";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  checkForDesktopUpdate,
  type DesktopAppInfo,
  type DesktopOsInfo,
  getDesktopAppInfo,
  getDesktopOsInfo,
  installDesktopUpdate,
  isDesktopRuntime,
} from "@/lib/tauri-updater";
import { SettingsGrid, SettingsPageLayout, SettingsPanel } from "../settings-page-layout";

type UpdateState =
  | { status: "idle"; message: string }
  | { status: "checking"; message: string }
  | { status: "available"; body?: string; message: string; version: string }
  | { status: "current"; message: string }
  | { status: "installing"; message: string }
  | { status: "error"; message: string };

type DesktopMetadataState = {
  appInfo: DesktopAppInfo | null;
  loading: boolean;
  osInfo: DesktopOsInfo | null;
};

type AboutState = {
  desktopMetadata: DesktopMetadataState;
  updateState: UpdateState;
};

function cardLabel(value: string | null | undefined) {
  return value && value.trim().length > 0 ? value : "Unavailable";
}

function buildInitialAboutState(): AboutState {
  return {
    desktopMetadata: {
      appInfo: null,
      loading: true,
      osInfo: null,
    },
    updateState: {
      status: "idle",
      message: isDesktopRuntime()
        ? "Loading desktop channel information…"
        : "Desktop update controls are only available in the desktop app.",
    },
  };
}

async function loadDesktopAboutState(): Promise<AboutState> {
  if (!isDesktopRuntime()) {
    return {
      desktopMetadata: {
        appInfo: null,
        loading: false,
        osInfo: null,
      },
      updateState: {
        status: "idle",
        message: "Desktop update controls are only available in the desktop app.",
      },
    };
  }

  try {
    const [appInfo, osInfo] = await Promise.all([getDesktopAppInfo(), getDesktopOsInfo()]);
    return {
      desktopMetadata: {
        appInfo,
        loading: false,
        osInfo,
      },
      updateState: {
        status: "idle",
        message: appInfo.updaterEnabled
          ? "Checks the published macOS release feed."
          : "This desktop channel does not use the published update feed.",
      },
    };
  } catch {
    return {
      desktopMetadata: {
        appInfo: null,
        loading: false,
        osInfo: null,
      },
      updateState: {
        status: "error",
        message: "Unable to load desktop channel information.",
      },
    };
  }
}

function useAboutState() {
  const [aboutState, setAboutState] = useState<AboutState>(buildInitialAboutState);

  useEffect(() => {
    let cancelled = false;

    loadDesktopAboutState()
      .then((nextState) => {
        if (!cancelled) {
          setAboutState(nextState);
        }
      })
      .catch(() => {
        /* fire-and-forget */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { aboutState, setAboutState };
}

function AboutInfoRows({ rows }: { rows: Array<{ label: string; value: React.ReactNode }> }) {
  return (
    <div className="space-y-2 font-mono text-w-sm">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-3">
          <span className="text-dim">{row.label}</span>
          <span className="text-foreground-secondary">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

function ApplicationPanel({ desktopMetadata }: { desktopMetadata: DesktopMetadataState }) {
  if (desktopMetadata.loading) {
    return (
      <SettingsPanel title="Application">
        <EmptyState message="Loading desktop application metadata…" />
      </SettingsPanel>
    );
  }

  return (
    <SettingsPanel title="Application">
      <AboutInfoRows
        rows={[
          { label: "Name", value: cardLabel(desktopMetadata.appInfo?.appName) },
          { label: "App Version", value: cardLabel(desktopMetadata.appInfo?.appVersion) },
          { label: "Tauri", value: cardLabel(desktopMetadata.appInfo?.tauriVersion) },
          { label: "Channel", value: cardLabel(desktopMetadata.appInfo?.channel) },
        ]}
      />
      <div className="mt-2 space-y-1 font-mono text-w-sm">
        <div className="text-dim">Identifier</div>
        <div className="break-all text-foreground-secondary">
          {cardLabel(desktopMetadata.appInfo?.identifier)}
        </div>
      </div>
    </SettingsPanel>
  );
}

function SystemPanel({ desktopMetadata }: { desktopMetadata: DesktopMetadataState }) {
  if (desktopMetadata.loading) {
    return (
      <SettingsPanel title="System">
        <EmptyState message="Loading system information…" />
      </SettingsPanel>
    );
  }

  if (!desktopMetadata.osInfo) {
    return (
      <SettingsPanel title="System">
        <div className="font-mono text-dim text-w-sm">
          System information is only available in the desktop app.
        </div>
      </SettingsPanel>
    );
  }

  return (
    <SettingsPanel title="System">
      <AboutInfoRows
        rows={[
          {
            label: "OS",
            value: `${desktopMetadata.osInfo.osType} ${desktopMetadata.osInfo.version}`,
          },
          { label: "Architecture", value: desktopMetadata.osInfo.arch },
          { label: "Hostname", value: cardLabel(desktopMetadata.osInfo.hostname) },
          { label: "Locale", value: cardLabel(desktopMetadata.osInfo.locale) },
        ]}
      />
    </SettingsPanel>
  );
}

function UpdatesPanel({
  desktopMetadata,
  onCheck,
  onInstall,
  updateState,
}: {
  desktopMetadata: DesktopMetadataState;
  onCheck: () => Promise<void>;
  onInstall: () => Promise<void>;
  updateState: UpdateState;
}) {
  return (
    <SettingsPanel title="Updates">
      <div className="space-y-2 font-mono text-w-sm">
        <div className="text-foreground-secondary">{updateState.message}</div>
        {updateState.status === "available" && updateState.body ? (
          <div className="rounded-item border border-border bg-background px-3 py-2 text-dim">
            {updateState.body}
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={onCheck}
          disabled={!desktopMetadata.appInfo?.updaterEnabled || updateState.status === "checking"}
        >
          {updateState.status === "checking" ? "Checking…" : "Check for Updates"}
        </Button>
        {updateState.status === "available" ? (
          <Button type="button" variant="outline" onClick={onInstall}>
            Install & Restart
          </Button>
        ) : null}
      </div>
    </SettingsPanel>
  );
}

function ReleaseFeedPanel({ desktopMetadata }: { desktopMetadata: DesktopMetadataState }) {
  return (
    <SettingsPanel title="Release Feed">
      <div className="space-y-2 font-mono text-foreground-secondary text-w-sm">
        {desktopMetadata.appInfo?.updaterEnabled ? (
          <>
            <div>Source: GitHub Releases latest channel</div>
            <div>Endpoint: latest.json from the newest published desktop release</div>
            <div>Draft releases are ignored until they are published.</div>
          </>
        ) : (
          <>
            <div>Source: Local development build</div>
            <div>Updater: disabled for this desktop channel</div>
            <div>Install new local builds by rebuilding and refreshing the app symlink.</div>
          </>
        )}
      </div>
    </SettingsPanel>
  );
}

export function SettingsAbout() {
  const { aboutState, setAboutState } = useAboutState();
  const { desktopMetadata, updateState } = aboutState;

  const statusText = useMemo(() => {
    if (!isDesktopRuntime()) return "Web mode";
    if (desktopMetadata.loading) return "Detecting desktop channel";
    if (desktopMetadata.appInfo?.updaterEnabled) return "Desktop updater enabled";
    if (desktopMetadata.appInfo?.channel === "dev") return "Desktop dev build";
    return "Desktop updater disabled";
  }, [
    desktopMetadata.appInfo?.channel,
    desktopMetadata.appInfo?.updaterEnabled,
    desktopMetadata.loading,
  ]);

  const handleCheckForUpdates = useCallback(async () => {
    if (!desktopMetadata.appInfo?.updaterEnabled) {
      return;
    }

    setAboutState((current) => ({
      ...current,
      updateState: {
        status: "checking",
        message: "Looking for a newer published Radarboard Desktop release…",
      },
    }));

    try {
      const update = await checkForDesktopUpdate();

      setAboutState((current) => ({
        ...current,
        updateState: update
          ? {
              status: "available",
              version: update.version,
              body: update.body,
              message: `Radarboard ${update.version} is available to install.`,
            }
          : {
              status: "current",
              message: "This install is already on the latest published version.",
            },
      }));
    } catch (error) {
      setAboutState((current) => ({
        ...current,
        updateState: {
          status: "error",
          message: error instanceof Error ? error.message : String(error),
        },
      }));
    }
  }, [desktopMetadata.appInfo?.updaterEnabled, setAboutState]);

  const handleInstallUpdate = useCallback(async () => {
    if (updateState.status !== "available") {
      return;
    }

    setAboutState((current) => ({
      ...current,
      updateState: {
        status: "installing",
        message: `Downloading Radarboard ${updateState.version}…`,
      },
    }));

    try {
      const update = await checkForDesktopUpdate();
      if (!update) {
        setAboutState((current) => ({
          ...current,
          updateState: {
            status: "current",
            message: "The update is no longer available. You are already current.",
          },
        }));
        return;
      }

      await installDesktopUpdate(update, (event) => {
        const message =
          event.event === "Progress"
            ? `${Math.round(event.data.chunkLength / 1024)} KB downloaded…`
            : event.event === "Finished"
              ? `Installing Radarboard ${update.version} and relaunching…`
              : `Downloading Radarboard ${update.version}…`;

        setAboutState((current) => ({
          ...current,
          updateState: {
            status: "installing",
            message,
          },
        }));
      });
    } catch (error) {
      setAboutState((current) => ({
        ...current,
        updateState: {
          status: "error",
          message: error instanceof Error ? error.message : String(error),
        },
      }));
    }
  }, [setAboutState, updateState]);

  return (
    <SettingsPageLayout
      title="About"
      description="Desktop version details, release channel status, and updater controls."
      statusText={statusText}
      statusColor={
        !isDesktopRuntime() ? "muted" : desktopMetadata.appInfo?.updaterEnabled ? "green" : "muted"
      }
      showSearch={false}
    >
      <SettingsGrid>
        <ApplicationPanel desktopMetadata={desktopMetadata} />
        <SystemPanel desktopMetadata={desktopMetadata} />
        <UpdatesPanel
          desktopMetadata={desktopMetadata}
          onCheck={handleCheckForUpdates}
          onInstall={handleInstallUpdate}
          updateState={updateState}
        />
        <ReleaseFeedPanel desktopMetadata={desktopMetadata} />
      </SettingsGrid>
    </SettingsPageLayout>
  );
}
