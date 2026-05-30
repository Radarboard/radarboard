// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useChart } from "./chart";

function Probe() {
  useChart();
  return null;
}

describe("useChart", () => {
  it("requires a ChartContainer provider", () => {
    expect(() => render(<Probe />)).toThrowError(
      "useChart must be used within a <ChartContainer />"
    );
  });
});
