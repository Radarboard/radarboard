"use client";

import type { PluginWidgetContribution } from "@radarboard/plugin-sdk/types";
import {
  createTemplateConfig,
  type DataSourceResolverProps,
  relativeTimeLabel,
  reportState,
  useStoredValue,
} from "@radarboard/plugin-sdk/widget-template-utils";
import { registerTemplateDataSource } from "@radarboard/widget-engine/templates";
import { useCallback, useEffect, useMemo } from "react";
import type { Note } from "./types";

function NotesResolver({ onState }: DataSourceResolverProps) {
  const { data, error, isLoading, mutate } = useStoredValue<Note[]>(
    "notes",
    "notes:list",
    "plugin-notes"
  );
  const refetch = useCallback(async () => {
    await mutate();
  }, [mutate]);
  const normalized = useMemo(
    () => ({
      notesCount: data?.length ?? 0,
      recentNotes: [...(data ?? [])]
        .slice(-4)
        .reverse()
        .map((note) => ({
          ...note,
          titleText: note.title,
          subtitleText: relativeTimeLabel(note.updatedAt),
          pluginUrl: `?plugin=notes&noteId=${encodeURIComponent(note.id)}`,
        })),
    }),
    [data]
  );

  useEffect(() => {
    reportState(onState, {
      data: normalized,
      fetchedAt: null,
      refetch,
      loading: isLoading,
      error: error?.message ?? null,
    });
  }, [normalized, refetch, isLoading, error, onState]);

  return null;
}

registerTemplateDataSource("plugin.notes.recent", NotesResolver);

export const notesWidgetContribution: PluginWidgetContribution = {
  widgetId: "recent",
  name: "Recent Notes",
  description: "Latest notes from the notes plugin",
  defaultSlot: "slot8",
  templateConfig: createTemplateConfig(
    {
      kind: "summary_list",
      summary: [
        {
          type: "headline-stat",
          source: { sourceId: "plugin.notes.recent", field: "notesCount", format: "number" },
          label: "notes",
        },
      ],
      rail: [],
      content: [
        {
          type: "row-list",
          source: { sourceId: "plugin.notes.recent", field: "recentNotes" },
          emptyMessage: "No notes yet",
          hrefSource: { sourceId: "plugin.notes.recent", field: "pluginUrl" },
          itemTemplate: {
            title: { sourceId: "plugin.notes.recent", field: "titleText" },
            subtitle: { sourceId: "plugin.notes.recent", field: "subtitleText" },
          },
        },
      ],
    },
    "plugin.notes.recent"
  ),
  pollingSourceIds: ["plugin-notes"],
  defaultPollInterval: 30_000,
};
