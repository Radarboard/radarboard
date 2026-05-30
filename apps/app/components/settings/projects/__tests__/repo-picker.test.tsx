// @vitest-environment jsdom

import { act, fireEvent, render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RepoPicker } from "../repo-picker";

const { connectedKeysState, swrCalls, fetcherCalls } = vi.hoisted(() => ({
  connectedKeysState: ["github"] as string[],
  swrCalls: [] as Array<string | null>,
  fetcherCalls: [] as Array<string>,
}));

vi.mock("@radarboard/hooks/use-credentials", () => ({
  useCredentials: () => ({
    connectedKeys: connectedKeysState,
  }),
}));

vi.mock("swr", () => ({
  default: vi.fn((key: string | null, fetcher?: (url: string) => unknown) => {
    swrCalls.push(key);
    if (key && fetcher) {
      fetcherCalls.push(key);
    }
    return {
      data: key?.includes("/api/integrations/github/repos")
        ? {
            repos: key.includes("q=goshuin")
              ? []
              : [
                  {
                    owner: "Radarboard",
                    repo: "radarboard",
                    fullName: "Radarboard/radarboard",
                    description: "Radarboard",
                    stars: 1,
                    language: "TypeScript",
                    isPrivate: true,
                    isFork: false,
                  },
                ],
          }
        : key?.includes("/api/integrations/github/contents")
          ? {
              isMonorepo: true,
              directories: [
                { name: ".agents", path: ".agents" },
                { name: "apps", path: "apps" },
              ],
            }
          : undefined,
      isLoading: false,
    };
  }),
}));

vi.mock("@/components/shared/remote-service-icon", () => ({
  RemoteServiceIcon: ({ alt }: { alt?: string }) => <span>{alt ?? "icon"}</span>,
}));

vi.mock("@radarboard/ui/button", () => ({
  Button: ({
    children,
    onClick,
    className,
    type = "button",
    ariaLabel,
    "aria-label": ariaLabelProp,
  }: {
    children: ReactNode;
    onClick?: () => void;
    className?: string;
    type?: "button" | "submit" | "reset";
    ariaLabel?: string;
    "aria-label"?: string;
  }) => (
    <button
      type={type}
      onClick={onClick}
      className={className}
      aria-label={ariaLabelProp ?? ariaLabel}
    >
      {children}
    </button>
  ),
}));

vi.mock("@radarboard/ui/input", () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    type = "text",
    className,
  }: {
    value?: string;
    onChange?: (event: { target: { value: string } }) => void;
    placeholder?: string;
    type?: string;
    className?: string;
  }) =>
    createElement("input", {
      type,
      value,
      onChange: (event: { target: { value: string } }) =>
        onChange?.({ target: { value: event.target.value } }),
      placeholder,
      className,
    }),
}));

vi.mock("@/lib/service-favicons", () => ({
  getServiceFaviconUrl: () => null,
}));

describe("RepoPicker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    swrCalls.length = 0;
    fetcherCalls.length = 0;
    connectedKeysState.splice(0, connectedKeysState.length, "github");
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("recomputes the repos query key after the debounced search updates", async () => {
    const onSelect = vi.fn();

    render(<RepoPicker currentRepo={null} onSelect={onSelect} />);

    fireEvent.change(screen.getByPlaceholderText("Search your repos..."), {
      target: { value: "goshuin" },
    });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(swrCalls).toContain("/api/integrations/github/repos?q=goshuin");
  });

  it("shows the empty-state message only after the filtered response is empty", async () => {
    const onSelect = vi.fn();

    render(<RepoPicker currentRepo={null} onSelect={onSelect} />);

    expect(screen.queryByText("No repos match your search.")).toBeNull();

    fireEvent.change(screen.getByPlaceholderText("Search your repos..."), {
      target: { value: "goshuin" },
    });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByText("No repos match your search.")).toBeTruthy();
  });

  it("uses a constrained selected-repo layout and hides dot-prefixed directories", async () => {
    const onSelect = vi.fn();

    await act(async () => {
      render(
        <RepoPicker
          currentRepo={{ owner: "thedaviddias", repo: "radarboard" }}
          onSelect={onSelect}
        />
      );
      await Promise.resolve();
    });

    const pathInput = screen.getByPlaceholderText("Scope to path (e.g., apps/my-app)");
    expect(pathInput.closest(".max-w-3xl")).toBeTruthy();
    expect(pathInput).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByText("Browse"));
    });

    expect(screen.getByText("apps")).toBeTruthy();
    expect(screen.queryByText(".agents")).toBeNull();
  });
});
