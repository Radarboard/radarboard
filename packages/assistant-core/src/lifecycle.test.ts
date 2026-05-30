import { describe, expect, it } from "vitest";
import { isTerminalRetrievalStatus, isTerminalRunStatus } from "./lifecycle";

describe("assistant lifecycle helpers", () => {
  it("treats only started statuses as non-terminal", () => {
    expect(isTerminalRunStatus("started")).toBe(false);
    expect(isTerminalRunStatus("completed")).toBe(true);
    expect(isTerminalRunStatus("failed")).toBe(true);

    expect(isTerminalRetrievalStatus("started")).toBe(false);
    expect(isTerminalRetrievalStatus("completed")).toBe(true);
    expect(isTerminalRetrievalStatus("failed")).toBe(true);
  });
});
