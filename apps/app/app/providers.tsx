"use client";

import { chatActions, ensureThread } from "@radarboard/assistant-ui/chat-store";
import { DashboardProvider } from "@radarboard/hooks/use-dashboard";
import { PluginHost } from "@radarboard/plugin-sdk/host";
import { setPluginSelection } from "@radarboard/plugin-sdk/store";
import type { AssistantHandoffItem } from "@radarboard/types/assistant";
import { DEFAULT_DASHBOARD_TIME_RANGE, type TimeRange } from "@radarboard/types/dashboard";
import type { IntentPayloadInput } from "@radarboard/types/intent";
// Register all first-party plugins, widgets, integrations, and polling sources
import "@/lib/integrations-init";
import "@/lib/plugins-init";
import "@/lib/polling-config";

import { HotkeysProvider } from "@tanstack/react-hotkeys";
import { useStore } from "@tanstack/react-store";
import { useParams, useRouter } from "next/navigation";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { SWRConfig } from "swr";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { ShortcutRuntimeBridge } from "@/components/shortcuts/shortcut-bridge";
import { OfflineIndicator } from "@/components/system/offline-indicator";
import { SyncPoller } from "@/components/system/sync-poller";
import { ThemeBridge } from "@/components/theme/theme-bridge";
import { useNativeNotifications } from "@/hooks/app/use-native-notifications";
import { persistentCacheProvider } from "@/hooks/app/use-persistent-cache";
import { useProjectGraphInvalidation } from "@/hooks/app/use-project-graph-invalidation";
import { useSSEInvalidation } from "@/hooks/app/use-sse-invalidation";
import { useTauriHealthSync } from "@/hooks/desktop/use-tauri-health-sync";
import { useTauriUpdater } from "@/hooks/desktop/use-tauri-updater";
import { usePluginConfigs } from "@/hooks/plugins/use-plugin-configs";
import { initClientDebugInstrumentation } from "@/lib/client-debug";
import { initializeDevExtensions } from "@/lib/dev-extensions-init";
import { isClientE2EMode, setClientE2EModeMarker } from "@/lib/e2e";
import { getDashboardHref, updateDashboardSearch } from "@/lib/project-routes";
import { deriveAllProjects } from "@/lib/projects/derived-projects";
import { initializeWidgets } from "@/lib/widgets-init";
import {
  loadSettings,
  settingsStore,
  updateProjectOrder,
  updateWidgetLayout,
} from "@/modules/settings/store/settings-store";

/**
 * Global SWR defaults for the dashboard.
 *
 * - revalidateOnFocus: false — prevents a burst of 8-12 parallel requests
 *   on every browser tab switch. The refreshInterval on each hook already
 *   handles periodic updates.
 * - dedupingInterval: 5000 — if the same SWR key is mounted in two places
 *   (e.g. KPI strip + widget), requests within 5 s are deduplicated.
 */
const SWR_OPTIONS = {
  revalidateOnFocus: false,
  dedupingInterval: 5000,
  keepPreviousData: true,
};

const TIME_RANGE_VALUES = ["today", "7d", "15d", "30d", "3m", "1y", "all"] as const;

interface PendingProjectState {
  active: boolean;
  slug: string | null;
}

function pushDashboardHref(router: ReturnType<typeof useRouter>, href: string) {
  const target = new URL(href, window.location.origin);
  const targetPath = `${target.pathname}${target.search}`;
  router.push(href);

  // Safety net: only force-navigate if the router completely stalls.
  // Using 3 s instead of 500 ms to avoid triggering during normal
  // Next.js App Router navigation, which can exceed 500 ms.
  window.setTimeout(() => {
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl !== targetPath) {
      window.location.assign(href);
    }
  }, 3000);
}

function applyPluginSelectionFromUpdates(updates: Record<string, string>) {
  if (!updates.plugin) return;
  const itemId =
    updates.entryId || updates.noteId || updates.taskId || updates.category || updates.rssItem;
  if (itemId) {
    setPluginSelection(updates.plugin, itemId);
  }
}

function buildHandoffItem(payload: IntentPayloadInput): AssistantHandoffItem {
  const getBodyMarkdown = () => {
    if (payload.kind === "structured")
      return (payload as { bodyMarkdown?: string }).bodyMarkdown ?? payload.title;
    if (payload.kind === "link") return `[${payload.title}](${(payload as { url: string }).url})`;
    return (payload as { body?: string }).body ?? payload.title;
  };
  const bodyMarkdown = getBodyMarkdown();

  return {
    id: `intent-${Date.now()}`,
    kind: payload.kind === "structured" ? (payload as { itemType: string }).itemType : payload.kind,
    title: payload.title,
    summary:
      payload.kind === "link"
        ? (payload as { url: string }).url
        : ((payload as { body?: string }).body ?? payload.title),
    bodyMarkdown,
    projectSlug: payload.projectSlug ?? null,
    metadata: payload.sourceMeta ?? {},
  };
}

export function Providers({ children }: { children: ReactNode }) {
  useTauriHealthSync();
  useTauriUpdater();
  const isE2EMode = isClientE2EMode();
  const params = useParams<{ slug?: string }>();
  const router = useRouter();
  const routeProjectSlug = typeof params.slug === "string" ? params.slug : null;
  const projectOrder = useStore(settingsStore, (s) => s.projectOrder);
  const projectIntegrations = useStore(settingsStore, (s) => s.projectIntegrations);
  const widgetLayout = useStore(settingsStore, (s) => s.widgetLayout);
  const isLoading = useStore(settingsStore, (s) => s.isLoading);
  const allProjects = deriveAllProjects(projectIntegrations);
  const [pendingProjectState, setPendingProjectState] = useState<PendingProjectState>({
    active: false,
    slug: null,
  });
  const pendingProjectSlug = pendingProjectState.active ? pendingProjectState.slug : null;
  const visualProjectSlug = pendingProjectState.active
    ? pendingProjectState.slug
    : routeProjectSlug;

  const [expandedWidgetId, setExpandedWidgetId] = useQueryState("expanded", parseAsString);
  const [activePluginId, setActivePluginId] = useQueryState("plugin", parseAsString);
  const [activePageSlug] = useQueryState("page", parseAsString);
  const [timeRange, setTimeRange] = useQueryState(
    "range",
    parseAsStringLiteral(TIME_RANGE_VALUES).withDefault(DEFAULT_DASHBOARD_TIME_RANGE)
  );

  useEffect(() => {
    initializeWidgets().catch(() => undefined);
    initializeDevExtensions();
  }, []);

  useEffect(() => {
    loadSettings().catch(() => {
      /* fire-and-forget */
    });
  }, []);

  const e2eMarkerSet = useRef(false);
  if (!e2eMarkerSet.current) {
    e2eMarkerSet.current = true;
    setClientE2EModeMarker(isE2EMode);
  }

  useEffect(() => {
    if (isE2EMode) return;
    initClientDebugInstrumentation();
  }, [isE2EMode]);

  useEffect(() => {
    if (!pendingProjectState.active) return;
    if (pendingProjectState.slug === routeProjectSlug) {
      setPendingProjectState({ active: false, slug: null });
    }
  }, [pendingProjectState, routeProjectSlug]);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js").catch(() => {
          // Service worker registration failed — non-critical
        });
      });
    }
  }, []);

  const pluginConfigs = usePluginConfigs();

  function SwrRuntimeBridges() {
    useSSEInvalidation();
    useProjectGraphInvalidation();
    return null;
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initial = Object.fromEntries(params.entries());
    applyPluginSelectionFromUpdates(initial);
  }, []);

  useEffect(() => {
    const handleNavigate = (e: Event) => {
      const href = (e as CustomEvent<string>).detail;
      if (!href) return;
      if (!href.startsWith("?")) {
        pushDashboardHref(router, href);
        return;
      }
      const updates = Object.fromEntries(new URLSearchParams(href.slice(1)));
      const currentSearch = typeof window !== "undefined" ? window.location.search.slice(1) : "";
      const nextSearch = updateDashboardSearch(currentSearch, updates);
      const fullHref = getDashboardHref(routeProjectSlug, nextSearch);

      applyPluginSelectionFromUpdates(updates);
      pushDashboardHref(router, fullHref);
    };
    window.addEventListener("radarboard:navigate", handleNavigate);
    return () => window.removeEventListener("radarboard:navigate", handleNavigate);
  }, [router, routeProjectSlug]);

  const { notify: nativeNotify } = useNativeNotifications();

  const pluginNotify = useCallback(
    (message: string, type?: "info" | "success" | "error") => {
      if (type === "error") nativeNotify("Error", message);
      else if (type === "success") nativeNotify("Success", message);
      else nativeNotify("Notification", message);
    },
    [nativeNotify]
  );

  const [, setChatParam] = useQueryState("chat", parseAsString);

  const handleSendToAssistant = useCallback(
    async (payload: IntentPayloadInput, promptHint?: string) => {
      const item = buildHandoffItem(payload);

      if (item.projectSlug) {
        chatActions.setPinnedProject(item.projectSlug);
      }

      await setChatParam("open");
      await ensureThread();
      chatActions.queueAssistantHandoff({
        items: [item],
        promptText: promptHint ?? null,
      });
    },
    [setChatParam]
  );

  const handleActivePluginChange = useCallback(
    (pluginId: string | null) => {
      setActivePluginId(pluginId).catch(() => {
        /* fire-and-forget */
      });
    },
    [setActivePluginId]
  );

  const handleExpandedWidgetIdChange = useCallback(
    (id: string | null) => {
      setExpandedWidgetId(id).catch(() => {
        /* fire-and-forget */
      });
    },
    [setExpandedWidgetId]
  );

  const handleTimeRangeChange = useCallback(
    (range: TimeRange) => {
      setTimeRange(range === DEFAULT_DASHBOARD_TIME_RANGE ? null : range).catch(() => {
        /* fire-and-forget */
      });
    },
    [setTimeRange]
  );

  const handleActiveProjectChange = useCallback(
    (slug: string | null) => {
      if (slug === visualProjectSlug) return;
      const currentSearch = typeof window === "undefined" ? "" : window.location.search.slice(1);
      const nextSearch = updateDashboardSearch(currentSearch, {}, [
        "page",
        "detail",
        "expanded",
        "widget-config",
      ]);
      setPendingProjectState({ active: true, slug });
      pushDashboardHref(router, getDashboardHref(slug, nextSearch));
    },
    [router, visualProjectSlug]
  );

  const handleActivePageChange = useCallback(
    (slug: string) => {
      const currentSearch = typeof window === "undefined" ? "" : window.location.search.slice(1);
      const nextSearch = updateDashboardSearch(currentSearch, { page: slug }, [
        "detail",
        "expanded",
        "widget-config",
      ]);

      pushDashboardHref(router, getDashboardHref(routeProjectSlug, nextSearch));
    },
    [routeProjectSlug, router]
  );

  const isProjectSwitching =
    pendingProjectState.active && pendingProjectState.slug !== routeProjectSlug;

  return (
    <HotkeysProvider>
      <SWRConfig value={{ ...SWR_OPTIONS, provider: persistentCacheProvider }}>
        <SwrRuntimeBridges />
        <DashboardProvider
          timeRange={timeRange}
          onTimeRangeChange={handleTimeRangeChange}
          activeProjectSlug={routeProjectSlug}
          activePageSlug={activePageSlug}
          pendingProjectSlug={pendingProjectSlug}
          isProjectSwitching={isProjectSwitching}
          onActiveProjectChange={handleActiveProjectChange}
          onActivePageChange={handleActivePageChange}
          projects={allProjects}
          projectOrder={projectOrder}
          onProjectOrderChange={updateProjectOrder}
          widgetLayoutConfig={widgetLayout}
          onWidgetLayoutConfigChange={updateWidgetLayout}
          expandedWidgetId={expandedWidgetId}
          onExpandedWidgetIdChange={handleExpandedWidgetIdChange}
        >
          <ThemeBridge />
          <ShortcutRuntimeBridge pluginConfigs={pluginConfigs} />
          <OfflineIndicator />
          <SyncPoller />
          <PluginHost
            activePluginId={activePluginId}
            onActivePluginChange={handleActivePluginChange}
            notify={pluginNotify}
            pluginConfigs={pluginConfigs}
            projects={allProjects.map((p) => ({ slug: p.slug, name: p.name, color: p.color }))}
            onSendToAssistant={handleSendToAssistant}
          >
            {isLoading ? <DashboardSkeleton /> : (children ?? null)}
          </PluginHost>
        </DashboardProvider>
      </SWRConfig>
    </HotkeysProvider>
  );
}
