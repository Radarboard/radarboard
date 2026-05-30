// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PomodoroSession } from "../types";
import { PomodoroTimer } from "./pomodoro";

describe("PomodoroTimer", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the empty state when no session exists", () => {
    render(createElement(PomodoroTimer, { session: null, onStop: vi.fn() }));

    expect(screen.getByText("No active timer. Start a Pomodoro from a task.")).toBeTruthy();
  });

  it("renders compact and full timer states", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-28T00:00:00.000Z"));
    const session: PomodoroSession = {
      taskId: "task-1",
      type: "work",
      startedAt: "2026-03-28T00:00:00.000Z",
      durationMinutes: 1,
      completedCycles: 2,
    };

    const { rerender } = render(
      createElement(PomodoroTimer, { session, onStop: vi.fn(), compact: true })
    );

    expect(screen.getByText("Focus")).toBeTruthy();

    rerender(createElement(PomodoroTimer, { session, onStop: vi.fn(), compact: false }));

    expect(screen.getByText("Cycle 3")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Stop/i })).toBeTruthy();
  });
});
