// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary, isRecoverableChunkLoadError } from "./index";

function ThrowChunkError(): React.JSX.Element {
  throw new Error(
    "Failed to load chunk /_next/static/chunks/settings-widgets.js from module settings-widgets"
  );
}

function ThrowRegularError(): React.JSX.Element {
  throw new Error("Regular render failure");
}

describe("ErrorBoundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("detects stale Next.js chunk load failures", () => {
    expect(
      isRecoverableChunkLoadError(new Error("Failed to load chunk /_next/static/chunks/a.js"))
    ).toBe(true);
    expect(isRecoverableChunkLoadError(new Error("Regular render failure"))).toBe(false);
  });

  it("offers a reload action for stale chunk errors", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <ErrorBoundary title="widgets">
        <ThrowChunkError />
      </ErrorBoundary>
    );

    expect(screen.getByRole("button", { name: "Reload" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("keeps retry action for normal render errors", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <ErrorBoundary title="widgets">
        <ThrowRegularError />
      </ErrorBoundary>
    );

    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });
});
