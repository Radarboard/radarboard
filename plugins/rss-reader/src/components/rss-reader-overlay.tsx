"use client";

import {
  FormField,
  FormInput,
  PluginFormDialog,
} from "@radarboard/plugin-sdk/components/form-dialog";
import { SendToContextMenu } from "@radarboard/plugin-sdk/components/intent-menu";
import { PluginListHeader } from "@radarboard/plugin-sdk/components/list-header";
import { ListRowChip, PluginListRow } from "@radarboard/plugin-sdk/components/list-row";
import { PluginEmptyState } from "@radarboard/plugin-sdk/components/plugin-empty";
import { FolderItem } from "@radarboard/plugin-sdk/components/sidebar/folder-item";
import { SidebarSection as SharedSidebarSection } from "@radarboard/plugin-sdk/components/sidebar/section-header";
import {
  SidebarHeader,
  SidebarShell,
} from "@radarboard/plugin-sdk/components/sidebar/sidebar-shell";
import { SidebarStats } from "@radarboard/plugin-sdk/components/sidebar/sidebar-stats";
import { ThreePaneWorkspace } from "@radarboard/plugin-sdk/components/three-pane-workspace";
import type { PluginRenderProps } from "@radarboard/plugin-sdk/types";
import { pluginRoute } from "@radarboard/types/api-routes";
import { Button } from "@radarboard/ui/button";
import { Input } from "@radarboard/ui/input";
import { SkeletonShimmer } from "@radarboard/ui/skeleton-shimmer";
import { Switch } from "@radarboard/ui/switch";
import { cn } from "@radarboard/utils/cn";
import {
  Bookmark,
  BookmarkPlus,
  ExternalLink,
  Folder,
  FolderPlus,
  Headphones,
  Library,
  ListChecks,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Rss,
  Save,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import useSWR from "swr";
import type { RssBoard, RssCategory, RssFeed, RssItem, RssSidebarSelection } from "../types";
import { useRssReader } from "../use-rss-reader";

async function fetchTtsMode(route: string): Promise<"audio" | "unavailable"> {
  const response = await fetch(route);
  const payload = (await response.json()) as { ok: boolean; mode?: "audio" | "unavailable" };
  return response.ok && payload.ok && payload.mode ? payload.mode : "unavailable";
}

function formatArticleDate(value: string): string {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function stripReaderText(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#>*_-]/g, " ")
    .replace(/\n{2,}/g, "\n\n")
    .replace(/\s+/g, " ")
    .trim();
}

function markdownIncludesImage(markdown: string, imageUrl: string | null | undefined): boolean {
  if (!imageUrl) return false;
  return markdown.includes(imageUrl);
}

function ReaderContent({
  markdown,
  heroImageUrl,
  heroImageCaption,
}: {
  markdown: string;
  heroImageUrl?: string | null;
  heroImageCaption?: string | null;
}) {
  const showHeroImage = heroImageUrl && !markdownIncludesImage(markdown, heroImageUrl);

  return (
    <article className="mx-auto w-full max-w-[760px] px-1 font-sans text-muted-foreground">
      {showHeroImage ? (
        <figure className="mb-6">
          <div
            role="img"
            aria-label={heroImageCaption ?? ""}
            className="block w-full object-cover"
            style={{
              maxHeight: "320px",
              minHeight: "180px",
              backgroundImage: `url("${heroImageUrl}")`,
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              backgroundSize: "cover",
            }}
          />
          {heroImageCaption ? (
            <figcaption className="mt-2 text-dim text-w-sm leading-5">
              {heroImageCaption}
            </figcaption>
          ) : null}
        </figure>
      ) : null}
      <Markdown
        remarkPlugins={[remarkGfm]}
        disallowedElements={["script", "iframe", "style", "link", "object", "embed"]}
        unwrapDisallowed
        skipHtml
        components={{
          h1: ({ children }) => (
            <h1 className="mt-6 mb-4 font-medium text-foreground text-w-2xl leading-tight first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-6 mb-3 font-medium text-foreground text-w-xl leading-tight">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-5 mb-3 font-semibold text-foreground text-w-base uppercase tracking-[0.18em]">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="mb-4 text-muted-foreground text-w-lg leading-7">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="mb-4 list-disc space-y-2 pl-5 text-muted-foreground text-w-lg leading-7">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-4 list-decimal space-y-2 pl-5 text-muted-foreground text-w-lg leading-7">
              {children}
            </ol>
          ),
          li: ({ children }) => <li>{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="mb-4 border-border border-l-2 pl-4 text-muted-foreground text-w-lg leading-7">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline decoration-accent/35 underline-offset-4 hover:text-accent/80"
            >
              {children}
            </a>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground-secondary">{children}</strong>
          ),
          img: ({ src, alt }) => (
            <span
              role="img"
              aria-label={alt ?? ""}
              className="mt-2 mb-4 block w-full object-cover"
              style={{
                minHeight: "180px",
                backgroundImage: src ? `url("${src}")` : undefined,
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
                backgroundSize: "cover",
              }}
            />
          ),
          code: ({ children }) => (
            <code className="border border-border bg-surface px-1.5 py-0.5 text-amber-400 text-w-base">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="mb-4 overflow-x-auto border border-border bg-surface-raised p-3 text-w-base leading-6">
              {children}
            </pre>
          ),
          hr: () => <hr className="my-6 border-border" />,
          table: ({ children }) => (
            <div className="mb-4 overflow-x-auto">
              <table className="w-full border-collapse text-left text-w-base leading-6">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-border border-b px-3 py-2 font-semibold text-foreground">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-border border-b px-3 py-2 text-muted-foreground">{children}</td>
          ),
        }}
      >
        {markdown}
      </Markdown>
    </article>
  );
}

function getSelectionLabel(
  selection: RssSidebarSelection,
  boards: RssBoard[],
  categories: RssCategory[],
  feeds: RssFeed[]
): string {
  switch (selection.kind) {
    case "all-unread":
      return "All Unread";
    case "saved":
      return "Saved";
    case "read-later":
      return "Read Later";
    case "integrations":
      return "Integrations";
    case "manual-feeds":
      return "My Feeds";
    case "boards":
      return "Boards";
    case "board":
      return boards.find((board) => board.id === selection.boardId)?.name ?? "Board";
    case "categories":
      return "Categories";
    case "category":
      return (
        categories.find((category) => category.id === selection.categoryId)?.name ?? "Category"
      );
    case "feed":
      return feeds.find((feed) => feed.id === selection.feedId)?.name ?? "Feed";
    default:
      return "Items";
  }
}

function matchesSelection(
  item: RssItem,
  selection: RssSidebarSelection,
  feedsById: Map<string, RssFeed>
): boolean {
  switch (selection.kind) {
    case "all-unread":
      return !item.read;
    case "saved":
      return item.saved;
    case "read-later":
      return item.readLater;
    case "integrations":
      return feedsById.get(item.feedId)?.origin === "integration";
    case "manual-feeds":
      return feedsById.get(item.feedId)?.origin === "manual";
    case "board":
      return item.boardIds.includes(selection.boardId);
    case "boards":
      return item.boardIds.length > 0;
    case "category":
      return feedsById.get(item.feedId)?.categoryIds.includes(selection.categoryId) ?? false;
    case "categories":
      return (feedsById.get(item.feedId)?.categoryIds.length ?? 0) > 0;
    case "feed":
      return item.feedId === selection.feedId;
    default:
      return true;
  }
}

function matchesSearchQuery(item: RssItem, searchQuery: string, feedName: string): boolean {
  if (!searchQuery) return true;

  return [item.title, item.excerpt ?? "", item.feedContent ?? "", feedName]
    .join(" ")
    .toLowerCase()
    .includes(searchQuery);
}

function getVisibleItems(
  items: RssItem[],
  selection: RssSidebarSelection,
  searchQuery: string,
  feedsById: Map<string, RssFeed>
): RssItem[] {
  return [...items]
    .filter((item) => matchesSelection(item, selection, feedsById))
    .filter((item) => matchesSearchQuery(item, searchQuery, feedsById.get(item.feedId)?.name ?? ""))
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));
}

function getFaviconUrl(articleUrl: string): string | null {
  try {
    const domain = new URL(articleUrl).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return null;
  }
}

function FaviconIndicator({ url, read }: { url: string; read: boolean }) {
  const faviconUrl = getFaviconUrl(url);

  if (!faviconUrl) {
    return (
      <span
        className={cn(
          "inline-block h-2 w-2 rounded-full",
          read ? "bg-dim" : "bg-foreground-secondary"
        )}
      />
    );
  }

  return (
    <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface p-px">
      <span
        aria-hidden="true"
        className="h-full w-full rounded-full bg-center bg-cover bg-no-repeat"
        style={{ backgroundImage: `url("${faviconUrl}")` }}
      />
    </span>
  );
}

function ArticleListItem({
  item,
  feedName,
  active,
  onSelect,
}: {
  item: RssItem;
  feedName: string;
  active: boolean;
  onSelect: (itemId: string) => void;
}) {
  return (
    <SendToContextMenu
      sourcePluginId="rss-reader"
      payload={{
        kind: "link",
        url: item.link,
        title: item.title,
        description: item.excerpt ?? undefined,
      }}
    >
      <PluginListRow
        indicator={<FaviconIndicator url={item.link} read={item.read} />}
        title={
          <span className={cn(item.read ? "text-dim" : "font-semibold text-foreground-secondary")}>
            {item.title}
          </span>
        }
        titleBadge={
          !item.read ? (
            <ListRowChip className="border-border bg-secondary text-muted-foreground">
              UNREAD
            </ListRowChip>
          ) : undefined
        }
        subtitle={
          <span className="flex items-center gap-2 font-mono text-w-sm uppercase tracking-wide">
            <span className="truncate">{feedName}</span>
            <span className="text-dim/40">·</span>
            <span className="shrink-0">{formatArticleDate(item.publishedAt)}</span>
          </span>
        }
        chips={
          <span className="flex items-center gap-3 font-mono text-dim text-w-sm">
            <span>{item.saved ? "Saved" : "Save"}</span>
            <span>{item.readLater ? "Read later" : "Later"}</span>
            {item.boardIds.length > 0 ? <span>{item.boardIds.length} boards</span> : null}
          </span>
        }
        selected={active}
        onClick={() => onSelect(item.id)}
      />
    </SendToContextMenu>
  );
}

const RSS_ITEM_QUERY_PARAM = "rssItem";

function useRssReaderOverlayController(
  api: PluginRenderProps["api"],
  {
    feeds,
    items,
    uiState,
    loaded,
    syncing,
    addCategory,
    addBoard,
    selectSidebar,
    selectItem,
    loadArticle,
  }: Pick<
    ReturnType<typeof useRssReader>,
    | "feeds"
    | "items"
    | "uiState"
    | "loaded"
    | "syncing"
    | "addCategory"
    | "addBoard"
    | "selectSidebar"
    | "selectItem"
    | "loadArticle"
  >
) {
  const [overlayUi, setOverlayUi] = useState({
    showFeedForm: false,
    editingFeedId: null as string | null,
    newCategoryName: "",
    newBoardName: "",
    contentMode: "webpage" as "webpage" | "feed",
    readAloudMode: "idle" as "idle" | "audio",
    isReadAloudActive: false,
    isReadAloudPaused: false,
    isReadAloudLoading: false,
    isSavingToRaindrop: false,
    raindropConnected: false,
  });
  const setContentMode = useCallback((contentMode: "webpage" | "feed") => {
    setOverlayUi((current) => ({ ...current, contentMode }));
  }, []);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const initialUrlItemIdRef = useRef<string | null | undefined>(undefined);
  const hasResolvedInitialUrlSelectionRef = useRef(false);
  const { data: ttsMode = "unavailable" } = useSWR(
    pluginRoute("rss-reader", "read-aloud"),
    fetchTtsMode,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }
  );

  const feedsById = useMemo(() => new Map(feeds.map((feed) => [feed.id, feed])), [feeds]);
  const selection = uiState.selection;
  const normalizedSearchQuery = uiState.searchQuery.trim().toLowerCase();
  const visibleItems = useMemo(
    () => getVisibleItems(items, selection, normalizedSearchQuery, feedsById),
    [feedsById, items, normalizedSearchQuery, selection]
  );

  const selectedItem =
    visibleItems.find((item) => item.id === uiState.selectedItemId) ?? visibleItems[0] ?? null;
  const selectedItemId = selectedItem?.id ?? null;
  const selectedItemHasExtractedContent = Boolean(selectedItem?.extractedContent);
  const selectedFeed = selectedItem ? (feedsById.get(selectedItem.feedId) ?? null) : null;
  const webpageMarkdown = selectedItem?.extractedContent ?? null;
  const feedMarkdown = selectedItem?.feedContent ?? selectedItem?.excerpt ?? null;
  const readerMarkdown =
    overlayUi.contentMode === "webpage"
      ? (webpageMarkdown ?? feedMarkdown)
      : (feedMarkdown ?? webpageMarkdown);
  const speechText = useMemo(
    () => (readerMarkdown ? stripReaderText(readerMarkdown) : ""),
    [readerMarkdown]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (initialUrlItemIdRef.current !== undefined) return;

    initialUrlItemIdRef.current = new URLSearchParams(window.location.search).get(
      RSS_ITEM_QUERY_PARAM
    );
    if (!initialUrlItemIdRef.current) {
      hasResolvedInitialUrlSelectionRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!loaded || hasResolvedInitialUrlSelectionRef.current) return;

    const urlSelectedItemId = initialUrlItemIdRef.current;
    if (!urlSelectedItemId) {
      hasResolvedInitialUrlSelectionRef.current = true;
      return;
    }

    if (uiState.selectedItemId === urlSelectedItemId) {
      hasResolvedInitialUrlSelectionRef.current = true;
      return;
    }

    if (visibleItems.some((item) => item.id === urlSelectedItemId)) {
      hasResolvedInitialUrlSelectionRef.current = true;
      selectItem(urlSelectedItemId);
      return;
    }

    if (items.some((item) => item.id === urlSelectedItemId)) {
      selectSidebar({ kind: "all-unread" });
      return;
    }

    if (!syncing) {
      hasResolvedInitialUrlSelectionRef.current = true;
    }
  }, [items, loaded, selectItem, selectSidebar, syncing, uiState.selectedItemId, visibleItems]);

  useEffect(() => {
    if (!loaded) return;
    if (!hasResolvedInitialUrlSelectionRef.current) return;
    if (uiState.selectedItemId && visibleItems.some((item) => item.id === uiState.selectedItemId)) {
      return;
    }
    const nextSelectedId = visibleItems[0]?.id ?? null;
    if ((uiState.selectedItemId ?? null) === nextSelectedId) return;
    selectItem(nextSelectedId);
  }, [loaded, selectItem, uiState.selectedItemId, visibleItems]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const currentValue = params.get(RSS_ITEM_QUERY_PARAM);
    const nextValue = selectedItem?.id ?? null;
    if (currentValue === nextValue) return;

    if (nextValue) params.set(RSS_ITEM_QUERY_PARAM, nextValue);
    else params.delete(RSS_ITEM_QUERY_PARAM);

    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;
    window.history.replaceState(window.history.state, "", nextUrl);
  }, [selectedItem?.id]);

  useEffect(() => {
    if (!selectedItem || selectedItem.extractedContent) return;
    loadArticle(selectedItem.id);
  }, [loadArticle, selectedItem]);

  useEffect(() => {
    if (!selectedItemId) return;
    setOverlayUi((current) => ({
      ...current,
      contentMode: selectedItemHasExtractedContent ? "webpage" : "feed",
    }));
  }, [selectedItemHasExtractedContent, selectedItemId]);

  useEffect(() => {
    let cancelled = false;

    api.dataSources
      .isConnected("raindrop")
      .then((connected) => {
        if (!cancelled) {
          setOverlayUi((current) => ({ ...current, raindropConnected: connected }));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOverlayUi((current) => ({ ...current, raindropConnected: false }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [api.dataSources]);

  const stopReadAloud = useCallback(() => {
    if (overlayUi.readAloudMode === "audio") {
      audioRef.current?.pause();
      audioRef.current = null;
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    }

    setOverlayUi((current) => ({
      ...current,
      readAloudMode: "idle",
      isReadAloudActive: false,
      isReadAloudPaused: false,
      isReadAloudLoading: false,
    }));
  }, [overlayUi.readAloudMode]);

  useEffect(() => () => stopReadAloud(), [stopReadAloud]);

  const startReadAloud = useCallback(async () => {
    if (!speechText) return;
    if (ttsMode !== "audio") {
      api.notify("Read aloud is unavailable until Piper is configured", "error");
      return;
    }

    stopReadAloud();
    setOverlayUi((current) => ({ ...current, isReadAloudLoading: true }));

    try {
      const response = await fetch(pluginRoute("rss-reader", "read-aloud"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: speechText }),
      });

      const contentType = response.headers.get("content-type") ?? "";

      if (response.ok && contentType.startsWith("audio/")) {
        const blob = await response.blob();
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        audioUrlRef.current = audioUrl;
        audio.onplay = () => {
          setOverlayUi((current) => ({
            ...current,
            isReadAloudLoading: false,
            isReadAloudActive: true,
            isReadAloudPaused: false,
          }));
        };
        audio.onended = stopReadAloud;
        audio.onerror = () => {
          stopReadAloud();
          api.notify("Piper audio failed to play", "error");
        };
        await audio.play();
        setOverlayUi((current) => ({ ...current, readAloudMode: "audio" }));
        return;
      }

      setOverlayUi((current) => ({ ...current, isReadAloudLoading: false }));
      api.notify("Piper did not return audio", "error");
    } catch {
      setOverlayUi((current) => ({ ...current, isReadAloudLoading: false }));
      api.notify("Piper synthesis failed", "error");
    }
  }, [api, speechText, stopReadAloud, ttsMode]);

  const toggleReadAloudPause = useCallback(() => {
    if (!overlayUi.isReadAloudActive) return;

    if (overlayUi.readAloudMode === "audio" && audioRef.current) {
      if (overlayUi.isReadAloudPaused) audioRef.current.play();
      else audioRef.current.pause();
    }

    setOverlayUi((current) => ({ ...current, isReadAloudPaused: !current.isReadAloudPaused }));
  }, [overlayUi.isReadAloudActive, overlayUi.isReadAloudPaused, overlayUi.readAloudMode]);

  const saveToRaindrop = useCallback(async () => {
    if (!selectedItem) return;

    setOverlayUi((current) => ({ ...current, isSavingToRaindrop: true }));
    try {
      const response = await fetch(pluginRoute("rss-reader", "save"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: "raindrop",
          title: selectedItem.title,
          url: selectedItem.link,
          excerpt: selectedItem.excerpt ?? "",
        }),
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Failed to save to Raindrop");
      }
      api.notify("Saved to Raindrop", "success");
    } catch (error) {
      api.notify(error instanceof Error ? error.message : "Failed to save to Raindrop", "error");
    } finally {
      setOverlayUi((current) => ({ ...current, isSavingToRaindrop: false }));
    }
  }, [api, selectedItem]);

  const refreshWebpageText = useCallback(async () => {
    if (!selectedItem) return;
    try {
      await loadArticle(selectedItem.id, true);
      setContentMode("webpage");
      api.notify("Webpage text refreshed", "success");
    } catch (error) {
      api.notify(
        error instanceof Error ? error.message : "Failed to refresh webpage text",
        "error"
      );
    }
  }, [api, loadArticle, selectedItem, setContentMode]);

  const handleAddCategory = useCallback(async () => {
    if (!overlayUi.newCategoryName.trim()) return;
    await addCategory(overlayUi.newCategoryName);
    setOverlayUi((current) => ({ ...current, newCategoryName: "" }));
  }, [addCategory, overlayUi.newCategoryName]);

  const handleAddBoard = useCallback(async () => {
    if (!overlayUi.newBoardName.trim()) return;
    await addBoard({ name: overlayUi.newBoardName });
    setOverlayUi((current) => ({ ...current, newBoardName: "" }));
  }, [addBoard, overlayUi.newBoardName]);

  return {
    overlayUi,
    setOverlayUi,
    setContentMode,
    ttsMode,
    feedsById,
    visibleItems,
    selectedItem,
    selectedFeed,
    webpageMarkdown,
    feedMarkdown,
    readerMarkdown,
    speechText,
    stopReadAloud,
    startReadAloud,
    toggleReadAloudPause,
    saveToRaindrop,
    refreshWebpageText,
    handleAddCategory,
    handleAddBoard,
  };
}

export function RssReaderOverlay({ api }: PluginRenderProps) {
  const {
    feeds,
    integrationFeeds,
    manualFeeds,
    items,
    boards,
    categories,
    uiState,
    loaded,
    syncing,
    loadingArticleId,
    unreadCount,
    addFeed,
    updateFeed,
    removeFeed,
    addCategory,
    addBoard,
    selectSidebar,
    selectItem,
    setSearchQuery,
    markRead,
    markUnread,
    toggleSaved,
    toggleReadLater,
    toggleBoard,
    loadArticle,
    syncFeeds,
  } = useRssReader(api);
  const {
    overlayUi,
    setOverlayUi,
    setContentMode,
    ttsMode,
    feedsById,
    visibleItems,
    selectedItem,
    selectedFeed,
    webpageMarkdown,
    feedMarkdown,
    readerMarkdown,
    speechText,
    stopReadAloud,
    startReadAloud,
    toggleReadAloudPause,
    saveToRaindrop,
    refreshWebpageText,
    handleAddCategory,
    handleAddBoard,
  } = useRssReaderOverlayController(api, {
    feeds,
    items,
    uiState,
    loaded,
    syncing,
    addCategory,
    addBoard,
    selectSidebar,
    selectItem,
    loadArticle,
  });

  return (
    <SkeletonShimmer loading={!loaded}>
      <div className="relative h-full">
        <ThreePaneWorkspace
          className="bg-surface"
          initialSidebarWidth={280}
          initialListWidth={360}
          minSidebarWidth={220}
          minListWidth={280}
          minDetailWidth={420}
          sidebarClassName="border-r border-border bg-surface-raised flex flex-col"
          listClassName="border-r border-border flex flex-col"
          detailClassName="bg-surface flex flex-col"
          sidebarTabLabel="Feeds"
          listTabLabel="Articles"
          detailKey={selectedItem?.id ?? null}
          sidebar={
            <RssReaderSidebarPane
              syncing={syncing}
              unreadCount={unreadCount}
              items={items}
              feeds={feeds}
              integrationFeeds={integrationFeeds}
              manualFeeds={manualFeeds}
              boards={boards}
              categories={categories}
              selection={uiState.selection}
              newBoardName={overlayUi.newBoardName}
              onNewBoardNameChange={(newBoardName) =>
                setOverlayUi((current) => ({ ...current, newBoardName }))
              }
              onAddBoard={handleAddBoard}
              newCategoryName={overlayUi.newCategoryName}
              onNewCategoryNameChange={(newCategoryName) =>
                setOverlayUi((current) => ({ ...current, newCategoryName }))
              }
              onAddCategory={handleAddCategory}
              onSyncFeeds={() => syncFeeds(false)}
              onSelectSidebar={selectSidebar}
              onStartAddFeed={() =>
                setOverlayUi((current) => ({
                  ...current,
                  editingFeedId: null,
                  showFeedForm: true,
                }))
              }
              onStartEditFeed={(feedId) =>
                setOverlayUi((current) => ({
                  ...current,
                  editingFeedId: feedId,
                  showFeedForm: true,
                }))
              }
              onRemoveFeed={removeFeed}
            />
          }
          list={
            <RssReaderListPane
              selection={uiState.selection}
              boards={boards}
              categories={categories}
              feeds={feeds}
              visibleItems={visibleItems}
              searchQuery={uiState.searchQuery}
              onSearchQueryChange={setSearchQuery}
              feedsById={feedsById}
              selectedItemId={selectedItem?.id ?? null}
              onSelectItem={selectItem}
            />
          }
          detail={
            selectedItem ? (
              <RssReaderDetailPane
                selectedItem={selectedItem}
                selectedFeed={selectedFeed}
                ttsMode={ttsMode}
                loadingArticleId={loadingArticleId}
                overlayUi={overlayUi}
                speechText={speechText}
                startReadAloud={startReadAloud}
                toggleReadAloudPause={toggleReadAloudPause}
                stopReadAloud={stopReadAloud}
                toggleSaved={toggleSaved}
                toggleReadLater={toggleReadLater}
                markRead={markRead}
                markUnread={markUnread}
                saveToRaindrop={saveToRaindrop}
                refreshWebpageText={refreshWebpageText}
                onSetContentMode={setContentMode}
                webpageMarkdown={webpageMarkdown}
                feedMarkdown={feedMarkdown}
                readerMarkdown={readerMarkdown}
                boards={boards}
                toggleBoard={toggleBoard}
              />
            ) : (
              <PluginEmptyState
                icon={<Rss className="icon-lg" />}
                title="Select an article to read it here"
              />
            )
          }
        />

        {overlayUi.showFeedForm ? (
          <FeedFormDialogSection
            categories={categories}
            feeds={feeds}
            editingFeedId={overlayUi.editingFeedId}
            onClose={() => {
              setOverlayUi((current) => ({
                ...current,
                showFeedForm: false,
                editingFeedId: null,
              }));
            }}
            onSubmit={async (input) => {
              try {
                if (overlayUi.editingFeedId) {
                  await updateFeed(overlayUi.editingFeedId, input);
                  api.notify("Feed updated", "success");
                } else {
                  await addFeed(input);
                  api.notify("Feed added", "success");
                }
                setOverlayUi((current) => ({
                  ...current,
                  showFeedForm: false,
                  editingFeedId: null,
                }));
              } catch (error) {
                api.notify(error instanceof Error ? error.message : "Failed to save feed", "error");
              }
            }}
          />
        ) : null}
      </div>
    </SkeletonShimmer>
  );
}

function InlineCreateControl({
  value,
  onChange,
  onSubmit,
  placeholder,
  icon,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1">
      <Input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        variant="surface"
        size="sm"
        className="w-[100px] bg-surface"
      />
      <Button
        type="button"
        onClick={onSubmit}
        disabled={!value.trim()}
        variant="outline"
        size="icon"
        uppercase={false}
        className="text-dim"
      >
        {icon}
      </Button>
    </div>
  );
}

function ActionPill({
  active,
  label,
  icon,
  onClick,
  disabled = false,
}: {
  active: boolean;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      variant={active ? "outline-accent" : "outline"}
      uppercase={false}
      className={cn(
        "gap-1.5 disabled:cursor-not-allowed disabled:opacity-40",
        active ? "text-sky-300" : "text-foreground-secondary"
      )}
    >
      {icon ? <span className="shrink-0">{icon}</span> : null}
      {label}
    </Button>
  );
}

function RssReaderSidebarPane({
  syncing,
  unreadCount,
  items,
  feeds,
  integrationFeeds,
  manualFeeds,
  boards,
  categories,
  selection,
  newBoardName,
  onNewBoardNameChange,
  onAddBoard,
  newCategoryName,
  onNewCategoryNameChange,
  onAddCategory,
  onSyncFeeds,
  onSelectSidebar,
  onStartAddFeed,
  onStartEditFeed,
  onRemoveFeed,
}: {
  syncing: boolean;
  unreadCount: number;
  items: RssItem[];
  feeds: RssFeed[];
  integrationFeeds: RssFeed[];
  manualFeeds: RssFeed[];
  boards: RssBoard[];
  categories: RssCategory[];
  selection: RssSidebarSelection;
  newBoardName: string;
  onNewBoardNameChange: (value: string) => void;
  onAddBoard: () => void;
  newCategoryName: string;
  onNewCategoryNameChange: (value: string) => void;
  onAddCategory: () => void;
  onSyncFeeds: () => void;
  onSelectSidebar: (selection: RssSidebarSelection) => void;
  onStartAddFeed: () => void;
  onStartEditFeed: (feedId: string) => void;
  onRemoveFeed: (feedId: string) => void;
}) {
  return (
    <SidebarShell
      header={
        <SidebarHeader
          label="RSS Reader"
          action={
            <Button
              type="button"
              onClick={onSyncFeeds}
              variant="outline"
              size="sm"
              uppercase={false}
              className="gap-1 text-muted-foreground"
            >
              <RefreshCw className={cn("icon-sm", syncing && "animate-spin")} />
              Sync
            </Button>
          }
          stats={
            <>
              <SidebarStats value={String(unreadCount)} label="Unread items" />
              <Button
                type="button"
                onClick={onStartAddFeed}
                variant="outline"
                uppercase={false}
                className="mt-3 gap-1.5"
              >
                <Plus className="icon-sm" />
                Add Feed
              </Button>
            </>
          }
        />
      }
    >
      <SharedSidebarSection title="Library">
        <FolderItem
          selected={selection.kind === "all-unread"}
          icon={<Rss className="icon-sm" />}
          label="All Unread"
          count={String(unreadCount)}
          onClick={() => onSelectSidebar({ kind: "all-unread" })}
        />
        <FolderItem
          selected={selection.kind === "read-later"}
          icon={<Bookmark className="icon-sm" />}
          label="Read Later"
          count={String(items.filter((item) => item.readLater).length)}
          onClick={() => onSelectSidebar({ kind: "read-later" })}
        />
        <FolderItem
          selected={selection.kind === "saved"}
          icon={<Save className="icon-sm" />}
          label="Saved"
          count={String(items.filter((item) => item.saved).length)}
          onClick={() => onSelectSidebar({ kind: "saved" })}
        />
      </SharedSidebarSection>

      <SharedSidebarSection
        title="Boards"
        action={
          <InlineCreateControl
            value={newBoardName}
            onChange={onNewBoardNameChange}
            onSubmit={onAddBoard}
            placeholder="New board"
            icon={<BookmarkPlus className="icon-sm" />}
          />
        }
      >
        <FolderItem
          selected={selection.kind === "boards"}
          icon={<Library className="icon-sm" />}
          label="All Boards"
          count={String(items.filter((item) => item.boardIds.length > 0).length)}
          onClick={() => onSelectSidebar({ kind: "boards" })}
        />
        {boards.map((board) => (
          <FolderItem
            key={board.id}
            selected={selection.kind === "board" ? selection.boardId === board.id : false}
            icon={<Bookmark className="icon-sm" />}
            label={board.name}
            count={String(items.filter((item) => item.boardIds.includes(board.id)).length)}
            onClick={() => onSelectSidebar({ kind: "board", boardId: board.id })}
          />
        ))}
      </SharedSidebarSection>

      <SharedSidebarSection title="Integrations">
        <FolderItem
          selected={selection.kind === "integrations"}
          icon={<ListChecks className="icon-sm" />}
          label="All Integration Feeds"
          count={String(integrationFeeds.length)}
          onClick={() => onSelectSidebar({ kind: "integrations" })}
        />
        {integrationFeeds.map((feed) => (
          <FolderItem
            key={feed.id}
            selected={selection.kind === "feed" ? selection.feedId === feed.id : false}
            icon={<Rss className="icon-sm" />}
            label={feed.name}
            count={String(items.filter((item) => item.feedId === feed.id && !item.read).length)}
            onClick={() => onSelectSidebar({ kind: "feed", feedId: feed.id })}
          />
        ))}
      </SharedSidebarSection>

      <SharedSidebarSection title="My Feeds">
        <FolderItem
          selected={selection.kind === "manual-feeds"}
          icon={<Rss className="icon-sm" />}
          label="All Manual Feeds"
          count={String(manualFeeds.length)}
          onClick={() => onSelectSidebar({ kind: "manual-feeds" })}
        />
        {manualFeeds.map((feed) => (
          <div key={feed.id} className="group">
            <FolderItem
              selected={selection.kind === "feed" ? selection.feedId === feed.id : false}
              icon={<Rss className="icon-sm" />}
              label={feed.name}
              count={String(items.filter((item) => item.feedId === feed.id && !item.read).length)}
              onClick={() => onSelectSidebar({ kind: "feed", feedId: feed.id })}
            />
            <div className="mt-1 hidden justify-end gap-1 pr-2 group-hover:flex">
              <Button
                type="button"
                onClick={() => onStartEditFeed(feed.id)}
                variant="ghost-link"
                uppercase={false}
                className="text-dim text-w-sm hover:text-foreground-secondary"
              >
                Edit
              </Button>
              <Button
                type="button"
                onClick={() => onRemoveFeed(feed.id)}
                variant="ghost-link"
                uppercase={false}
                className="text-dim text-w-sm hover:text-rose-400"
              >
                Remove
              </Button>
            </div>
          </div>
        ))}
      </SharedSidebarSection>

      <SharedSidebarSection
        title="Categories"
        action={
          <InlineCreateControl
            value={newCategoryName}
            onChange={onNewCategoryNameChange}
            onSubmit={onAddCategory}
            placeholder="New category"
            icon={<FolderPlus className="icon-sm" />}
          />
        }
      >
        <FolderItem
          selected={selection.kind === "categories"}
          icon={<Folder className="icon-sm" />}
          label="All Categories"
          count={String(categories.length)}
          onClick={() => onSelectSidebar({ kind: "categories" })}
        />
        {categories.map((category) => (
          <FolderItem
            key={category.id}
            selected={selection.kind === "category" ? selection.categoryId === category.id : false}
            icon={<Folder className="icon-sm" />}
            label={category.name}
            count={String(feeds.filter((feed) => feed.categoryIds.includes(category.id)).length)}
            onClick={() => onSelectSidebar({ kind: "category", categoryId: category.id })}
          />
        ))}
      </SharedSidebarSection>
    </SidebarShell>
  );
}

function RssReaderDetailPane({
  selectedItem,
  selectedFeed,
  ttsMode,
  loadingArticleId,
  overlayUi,
  speechText,
  startReadAloud,
  toggleReadAloudPause,
  stopReadAloud,
  toggleSaved,
  toggleReadLater,
  markRead,
  markUnread,
  saveToRaindrop,
  refreshWebpageText,
  onSetContentMode,
  webpageMarkdown,
  feedMarkdown,
  readerMarkdown,
  boards,
  toggleBoard,
}: {
  selectedItem: RssItem;
  selectedFeed: RssFeed | null;
  ttsMode: "audio" | "unavailable";
  loadingArticleId: string | null;
  overlayUi: {
    contentMode: "webpage" | "feed";
    isReadAloudActive: boolean;
    isReadAloudPaused: boolean;
    isReadAloudLoading: boolean;
    isSavingToRaindrop: boolean;
    raindropConnected: boolean;
  };
  speechText: string;
  startReadAloud: () => void;
  toggleReadAloudPause: () => void;
  stopReadAloud: () => void;
  toggleSaved: (itemId: string) => void;
  toggleReadLater: (itemId: string) => void;
  markRead: (itemId: string) => void;
  markUnread: (itemId: string) => void;
  saveToRaindrop: () => void;
  refreshWebpageText: () => void;
  onSetContentMode: (mode: "webpage" | "feed") => void;
  webpageMarkdown: string | null;
  feedMarkdown: string | null;
  readerMarkdown: string | null;
  boards: RssBoard[];
  toggleBoard: (itemId: string, boardId: string) => void;
}) {
  return (
    <>
      <div className="space-y-3 border-border border-b px-4 py-3">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="font-mono text-dim text-w-sm uppercase tracking-widest">
              {selectedFeed?.name ?? "Feed"}
            </div>
            <h1 className="mt-2 text-2xl text-foreground-secondary leading-tight">
              {selectedItem.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-dim text-xs">
              <span>{formatArticleDate(selectedItem.publishedAt)}</span>
              {selectedItem.author ? <span>• {selectedItem.author}</span> : null}
              {loadingArticleId === selectedItem.id ? <span>• extracting…</span> : null}
              <span>• {ttsMode === "audio" ? "Piper ready" : "Piper unavailable"}</span>
            </div>
            {ttsMode !== "audio" ? (
              <div className="mt-2 text-dim text-w-sm">
                Configure <span className="font-mono text-muted-foreground">PIPER_MODEL_PATH</span>{" "}
                to enable read aloud.
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <ActionPill
              active={overlayUi.isReadAloudActive || overlayUi.isReadAloudLoading}
              label={
                overlayUi.isReadAloudLoading
                  ? "Loading..."
                  : overlayUi.isReadAloudActive
                    ? "Playing"
                    : "Listen"
              }
              icon={
                overlayUi.isReadAloudActive || overlayUi.isReadAloudLoading ? (
                  <Headphones className="icon-sm" />
                ) : (
                  <Play className="icon-sm" />
                )
              }
              onClick={startReadAloud}
              disabled={!speechText || overlayUi.isReadAloudLoading || ttsMode !== "audio"}
            />
            {overlayUi.isReadAloudActive ? (
              <>
                <ActionPill
                  active={overlayUi.isReadAloudPaused}
                  label={overlayUi.isReadAloudPaused ? "Resume" : "Pause"}
                  icon={
                    overlayUi.isReadAloudPaused ? (
                      <Play className="icon-sm" />
                    ) : (
                      <Pause className="icon-sm" />
                    )
                  }
                  onClick={toggleReadAloudPause}
                />
                <ActionPill active={false} label="Stop" onClick={stopReadAloud} />
              </>
            ) : null}
            <ActionPill
              active={selectedItem.saved}
              label={selectedItem.saved ? "Saved" : "Save"}
              onClick={() => toggleSaved(selectedItem.id)}
            />
            <ActionPill
              active={selectedItem.readLater}
              label={selectedItem.readLater ? "Read Later" : "Later"}
              onClick={() => toggleReadLater(selectedItem.id)}
            />
            <ActionPill
              active={!selectedItem.read}
              label={selectedItem.read ? "Mark Unread" : "Mark Read"}
              onClick={() =>
                selectedItem.read ? markUnread(selectedItem.id) : markRead(selectedItem.id)
              }
            />
            <a
              href={selectedItem.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-item border border-border px-3 py-1.5 font-mono text-foreground-secondary text-w-sm hover:bg-surface-raised"
            >
              Open
              <ExternalLink className="icon-sm" />
            </a>
            {overlayUi.raindropConnected ? (
              <ActionPill
                active={false}
                label={overlayUi.isSavingToRaindrop ? "Saving..." : "Raindrop"}
                onClick={saveToRaindrop}
                disabled={overlayUi.isSavingToRaindrop}
              />
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ActionPill
            active={overlayUi.contentMode === "webpage"}
            label="Webpage text"
            onClick={() => onSetContentMode("webpage")}
            disabled={!webpageMarkdown}
          />
          <ActionPill
            active={overlayUi.contentMode === "feed"}
            label="Feed text"
            onClick={() => onSetContentMode("feed")}
            disabled={!feedMarkdown}
          />
          <ActionPill
            active={false}
            label={loadingArticleId === selectedItem.id ? "Refreshing..." : "Refresh webpage"}
            onClick={refreshWebpageText}
            disabled={loadingArticleId === selectedItem.id}
          />
        </div>

        {boards.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {boards.map((board) => (
              <Button
                key={board.id}
                type="button"
                onClick={() => toggleBoard(selectedItem.id, board.id)}
                variant={selectedItem.boardIds.includes(board.id) ? "outline-accent" : "outline"}
                uppercase={false}
                className={cn(
                  selectedItem.boardIds.includes(board.id)
                    ? "text-sky-300"
                    : "text-dim hover:bg-surface-raised"
                )}
              >
                {board.name}
              </Button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="scrollbar-thin flex-1 overflow-y-auto px-6 py-6">
        {readerMarkdown ? (
          <ReaderContent
            markdown={readerMarkdown}
            heroImageUrl={selectedItem.heroImageUrl}
            heroImageCaption={selectedItem.heroImageCaption}
          />
        ) : (
          <div className="text-dim text-sm">
            No extracted article content yet. Use <span className="text-dim">Open</span> to read the
            original article.
          </div>
        )}
      </div>
    </>
  );
}

function RssReaderListPane({
  selection,
  boards,
  categories,
  feeds,
  visibleItems,
  searchQuery,
  onSearchQueryChange,
  feedsById,
  selectedItemId,
  onSelectItem,
}: {
  selection: RssSidebarSelection;
  boards: RssBoard[];
  categories: RssCategory[];
  feeds: RssFeed[];
  visibleItems: RssItem[];
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  feedsById: Map<string, RssFeed>;
  selectedItemId: string | null;
  onSelectItem: (itemId: string) => void;
}) {
  return (
    <>
      <PluginListHeader
        label={getSelectionLabel(selection, boards, categories, feeds)}
        search={{
          value: searchQuery,
          onChange: onSearchQueryChange,
          placeholder: "Search articles...",
        }}
        count={`${visibleItems.length} article${visibleItems.length !== 1 ? "s" : ""}`}
      />

      <div className="scrollbar-thin flex-1 divide-y divide-border overflow-y-auto">
        {visibleItems.length === 0 ? (
          <PluginEmptyState title="No articles for this view yet" />
        ) : (
          visibleItems.map((item) => (
            <ArticleListItem
              key={item.id}
              item={item}
              feedName={feedsById.get(item.feedId)?.name ?? "Feed"}
              active={selectedItemId === item.id}
              onSelect={onSelectItem}
            />
          ))
        )}
      </div>
    </>
  );
}

function FeedFormDialogSection({
  categories,
  feeds,
  editingFeedId,
  onClose,
  onSubmit,
}: {
  categories: RssCategory[];
  feeds: RssFeed[];
  editingFeedId: string | null;
  onClose: () => void;
  onSubmit: (input: {
    name: string;
    url: string;
    categoryIds: string[];
    isEnabled?: boolean;
  }) => Promise<void>;
}) {
  return (
    <FeedForm
      categories={categories}
      feed={editingFeedId ? (feeds.find((feed) => feed.id === editingFeedId) ?? null) : null}
      onCancel={onClose}
      onSubmit={onSubmit}
    />
  );
}

function FeedForm({
  categories,
  feed,
  onCancel,
  onSubmit,
}: {
  categories: RssCategory[];
  feed: RssFeed | null;
  onCancel: () => void;
  onSubmit: (input: {
    name: string;
    url: string;
    categoryIds: string[];
    isEnabled?: boolean;
  }) => Promise<void>;
}) {
  const [name, setName] = useState(feed?.name ?? "");
  const [url, setUrl] = useState(feed?.url ?? "");
  const [categoryIds, setCategoryIds] = useState<string[]>(feed?.categoryIds ?? []);
  const [isEnabled, setIsEnabled] = useState(feed?.isEnabled ?? true);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const canEditIdentity = feed?.isEditable ?? true;

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  return (
    <PluginFormDialog
      open
      onClose={onCancel}
      title={feed ? "Edit Feed" : "Add Feed"}
      submitLabel={feed ? "Save Feed" : "Add Feed"}
      submitDisabled={canEditIdentity && (!name.trim() || !url.trim())}
      onSubmit={() => {
        onSubmit({
          name: canEditIdentity ? name.trim() : (feed?.name ?? ""),
          url: canEditIdentity ? url.trim() : (feed?.url ?? ""),
          categoryIds,
          isEnabled,
        }).catch(() => {
          /* fire-and-forget */
        });
      }}
    >
      {feed?.origin === "integration" && (
        <p className="text-dim text-sm">
          Integration feeds keep their URL from Integrations settings. You can only change local
          organization and enabled state here.
        </p>
      )}

      <FormField label="Name">
        <FormInput
          ref={nameInputRef}
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={!canEditIdentity}
          placeholder="Feed name"
        />
      </FormField>

      <FormField label="URL">
        <FormInput
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          disabled={!canEditIdentity}
          placeholder="https://example.com/blog"
        />
      </FormField>

      {categories.length > 0 && (
        <FormField label="Categories">
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => {
              const active = categoryIds.includes(category.id);
              return (
                <Button
                  key={category.id}
                  type="button"
                  onClick={() =>
                    setCategoryIds((current) =>
                      active ? current.filter((c) => c !== category.id) : [...current, category.id]
                    )
                  }
                  variant={active ? "outline-accent" : "outline"}
                  uppercase={false}
                  className={cn(active ? "text-sky-300" : "text-dim hover:bg-surface-raised")}
                >
                  {category.name}
                </Button>
              );
            })}
          </div>
        </FormField>
      )}

      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Switch
          checked={isEnabled}
          onCheckedChange={setIsEnabled}
          aria-label="Feed enabled"
          size="sm"
        />
        Feed enabled
      </div>
    </PluginFormDialog>
  );
}
