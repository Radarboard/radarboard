// @vitest-environment jsdom

import { DATA_SOURCE_REGISTRY } from "@radarboard/widget-sdk/data-source-registry";
import { render, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../data-resolver";

const useRoadmapMock = vi.fn();

vi.mock("../hooks/use-roadmap", () => ({
  useRoadmap: (...args: unknown[]) => useRoadmapMock(...args),
}));

describe("roadmap data resolver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRoadmapMock.mockReturnValue({
      projects: [
        {
          id: "proj-1",
          name: "Spring Release",
          progress: 0.42,
          health: "offTrack",
          targetDate: "2026-04-20",
        },
      ],
      inProgressIssues: [{ id: "issue-1" }, { id: "issue-2" }],
      configured: true,
      fetchedAt: 321,
      loading: false,
      error: null,
      refetch: vi.fn(async () => {}),
    });
  });

  it("reports transformed roadmap summary data", async () => {
    const Resolver = DATA_SOURCE_REGISTRY.get("roadmap");
    const onState = vi.fn();

    if (!Resolver) throw new Error("roadmap resolver not registered");

    render(createElement(Resolver, { projectSlug: "atlas", onState }));

    await waitFor(() => {
      expect(onState).toHaveBeenCalledWith(
        expect.objectContaining({
          fetchedAt: 321,
          loading: false,
          error: null,
          data: expect.objectContaining({
            configured: true,
            wipCount: "2",
            blockedCount: "0",
            nextReleaseItems: [
              expect.objectContaining({
                id: "proj-1",
                progressLabel: "42%",
                healthColor: "#e05555",
                targetDateLabel: "Apr 20",
              }),
            ],
          }),
        })
      );
    });
    expect(useRoadmapMock).toHaveBeenCalledWith("atlas");
  });

  it("reports empty next-release state when no projects are available", async () => {
    useRoadmapMock.mockReturnValue({
      projects: [],
      inProgressIssues: [],
      configured: false,
      fetchedAt: null,
      loading: true,
      error: "missing config",
      refetch: null,
    });
    const Resolver = DATA_SOURCE_REGISTRY.get("roadmap");
    const onState = vi.fn();

    if (!Resolver) throw new Error("roadmap resolver not registered");

    render(createElement(Resolver, { projectSlug: null, onState }));

    await waitFor(() => {
      expect(onState).toHaveBeenCalledWith(
        expect.objectContaining({
          loading: true,
          error: "missing config",
          data: expect.objectContaining({
            configured: false,
            wipCount: "0",
            nextReleaseItems: [],
          }),
        })
      );
    });
  });
});
