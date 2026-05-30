// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTauriUpdater } from "../use-tauri-updater";

const mockCheck = vi.fn();
const mockGetIdentifier = vi.fn();
const mockGetName = vi.fn();
const mockGetTauriVersion = vi.fn();
const mockGetVersion = vi.fn();
const mockRelaunch = vi.fn();
const mockListen = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastInfo = vi.fn();
const mockToastError = vi.fn();
const mockToastLoading = vi.fn();
const mockToastDismiss = vi.fn();

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: (...args: unknown[]) => mockCheck(...args),
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: (...args: unknown[]) => mockRelaunch(...args),
}));

vi.mock("@tauri-apps/api/app", () => ({
  getIdentifier: (...args: unknown[]) => mockGetIdentifier(...args),
  getName: (...args: unknown[]) => mockGetName(...args),
  getTauriVersion: (...args: unknown[]) => mockGetTauriVersion(...args),
  getVersion: (...args: unknown[]) => mockGetVersion(...args),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: (...args: unknown[]) => mockListen(...args),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    info: (...args: unknown[]) => mockToastInfo(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    loading: (...args: unknown[]) => mockToastLoading(...args),
    dismiss: (...args: unknown[]) => mockToastDismiss(...args),
  },
}));

function enableTauri() {
  Object.defineProperty(window, "__TAURI_INTERNALS__", {
    configurable: true,
    value: {},
  });
  Object.defineProperty(window, "location", {
    configurable: true,
    value: new URL("http://127.0.0.1:3000"),
  });
}

function disableTauri() {
  Reflect.deleteProperty(window, "__TAURI_INTERNALS__");
}

describe("useTauriUpdater", () => {
  beforeEach(() => {
    enableTauri();
    vi.useFakeTimers();
    vi.stubEnv("NODE_ENV", "production");
    mockCheck.mockReset();
    mockGetIdentifier.mockReset();
    mockGetName.mockReset();
    mockGetTauriVersion.mockReset();
    mockGetVersion.mockReset();
    mockRelaunch.mockReset();
    mockListen.mockReset();
    mockToastSuccess.mockReset();
    mockToastInfo.mockReset();
    mockToastError.mockReset();
    mockToastLoading.mockReset();
    mockToastDismiss.mockReset();
    mockGetIdentifier.mockResolvedValue("com.radarboard.client");
    mockGetName.mockResolvedValue("Radarboard");
    mockGetTauriVersion.mockResolvedValue("2.0.0");
    mockGetVersion.mockResolvedValue("0.1.0");
    mockListen.mockResolvedValue(vi.fn());
  });

  afterEach(() => {
    disableTauri();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("does nothing outside Tauri", async () => {
    disableTauri();
    renderHook(() => useTauriUpdater());

    await vi.runAllTimersAsync();
    expect(mockCheck).not.toHaveBeenCalled();
  });

  it("silently checks for updates on startup", async () => {
    mockCheck.mockResolvedValue(null);

    renderHook(() => useTauriUpdater());

    await vi.runAllTimersAsync();

    expect(mockCheck).toHaveBeenCalledTimes(1);
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it("skips updater wiring for dev channel builds", async () => {
    mockGetIdentifier.mockResolvedValue("com.radarboard.client.dev");

    renderHook(() => useTauriUpdater());

    await vi.runAllTimersAsync();

    expect(mockListen).not.toHaveBeenCalled();
    expect(mockCheck).not.toHaveBeenCalled();
  });

  it("shows an up-to-date toast on manual check when no update exists", async () => {
    let handler: (() => void) | null = null;
    mockListen.mockImplementation(async (_event: string, callback: () => void) => {
      handler = callback;
      return vi.fn();
    });
    mockCheck.mockResolvedValue(null);

    renderHook(() => useTauriUpdater());

    await vi.waitFor(() => {
      expect(mockListen).toHaveBeenCalled();
    });

    expect(handler).not.toBeNull();
    await handler?.();

    await vi.waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Radarboard is already up to date.", {
        id: "desktop-updater",
      });
    });
  });

  it("shows an install toast when an update is available", async () => {
    mockCheck.mockResolvedValue({
      version: "0.2.0",
      body: "New fixes and improvements",
    });

    renderHook(() => useTauriUpdater());

    await vi.runAllTimersAsync();

    expect(mockToastInfo).toHaveBeenCalledWith(
      "Radarboard 0.2.0 is available",
      expect.objectContaining({
        id: "desktop-updater",
        action: expect.objectContaining({ label: "Install & Restart" }),
      })
    );
  });
});
