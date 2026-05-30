"use client";

import type { PluginWidgetContribution } from "@radarboard/plugin-sdk/types";
import {
  createTemplateConfig,
  type DataSourceResolverProps,
  reportState,
  useStoredValue,
} from "@radarboard/plugin-sdk/widget-template-utils";
import { registerTemplateDataSource } from "@radarboard/widget-engine/templates";
import { useCallback, useEffect, useMemo } from "react";
import type { PomodoroSession, Task } from "./types";

function TasksResolver({ onState }: DataSourceResolverProps) {
  const {
    data: tasksData,
    error: tasksError,
    isLoading: tasksLoading,
    mutate: mutateTasks,
  } = useStoredValue<Task[]>("tasks", "tasks:list", "plugin-tasks");
  const {
    data: pomodoroData,
    error: pomodoroError,
    isLoading: pomodoroLoading,
    mutate: mutatePomodoro,
  } = useStoredValue<PomodoroSession>("tasks", "tasks:pomodoro:current", "plugin-tasks");
  const refetch = useCallback(async () => {
    await Promise.all([mutateTasks(), mutatePomodoro()]);
  }, [mutatePomodoro, mutateTasks]);

  const normalized = useMemo(() => {
    const allTasks = tasksData ?? [];
    const today = new Date().toLocaleDateString("en-CA");
    const todayTasks = allTasks.filter((task) => {
      if (task.status === "done") return false;
      if (!task.dueDate) return true;
      return task.dueDate <= today;
    });

    return {
      todoCount: todayTasks.filter((task) => task.status === "todo").length,
      activeCount: todayTasks.filter((task) => task.status === "in-progress").length,
      doneToday: allTasks.filter(
        (task) => task.status === "done" && task.updatedAt.startsWith(today)
      ).length,
      pomodoroLabel: pomodoroData
        ? `Pomodoro · ${pomodoroData.type === "work" ? "Focus" : "Break"}`
        : null,
      tasks: todayTasks.map((task) => ({
        ...task,
        titleText: task.title,
        subtitleText: task.priority,
        statusTone: (() => {
          if (task.status === "in-progress") return "#f5c542";
          if (task.priority === "urgent") return "#e05555";
          return "#666";
        })(),
        pluginUrl: `?plugin=tasks&taskId=${encodeURIComponent(task.id)}`,
      })),
    };
  }, [tasksData, pomodoroData]);

  useEffect(() => {
    reportState(onState, {
      data: normalized,
      fetchedAt: null,
      refetch,
      loading: tasksLoading || pomodoroLoading,
      error: tasksError?.message ?? pomodoroError?.message ?? null,
    });
  }, [normalized, refetch, tasksLoading, pomodoroLoading, tasksError, pomodoroError, onState]);

  return null;
}

registerTemplateDataSource("plugin.tasks.today", TasksResolver);

export const tasksWidgetContribution: PluginWidgetContribution = {
  widgetId: "today",
  name: "Today's Tasks",
  description: "Today's tasks and current Pomodoro session",
  defaultSlot: "slot8",
  templateConfig: createTemplateConfig(
    {
      kind: "summary_content",
      summary: [
        {
          type: "kpi-row",
          columns: 3,
          variant: "compact",
          metrics: [
            {
              label: "Todo",
              source: { sourceId: "plugin.tasks.today", field: "todoCount", format: "number" },
            },
            {
              label: "Active",
              source: { sourceId: "plugin.tasks.today", field: "activeCount", format: "number" },
            },
            {
              label: "Done",
              source: { sourceId: "plugin.tasks.today", field: "doneToday", format: "number" },
            },
          ],
        },
        {
          type: "alert",
          severity: "info",
          message: "{{value}}",
          source: { sourceId: "plugin.tasks.today", field: "pomodoroLabel" },
          condition: {
            source: { sourceId: "plugin.tasks.today", field: "pomodoroLabel" },
            operator: "neq",
            value: "",
          },
        },
      ],
      rail: [],
      content: [
        {
          type: "row-list",
          source: { sourceId: "plugin.tasks.today", field: "tasks" },
          emptyMessage: "No tasks for today",
          hrefSource: { sourceId: "plugin.tasks.today", field: "pluginUrl" },
          itemTemplate: {
            status: { source: { sourceId: "plugin.tasks.today", field: "statusTone" } },
            title: { sourceId: "plugin.tasks.today", field: "titleText" },
            subtitle: { sourceId: "plugin.tasks.today", field: "subtitleText" },
          },
        },
      ],
    },
    "plugin.tasks.today"
  ),
  pollingSourceIds: ["plugin-tasks"],
  defaultPollInterval: 30_000,
};
