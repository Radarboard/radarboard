import { describe, expect, it } from "vitest";

import {
  executeCreateLinearIssue,
  executeListLinearLabels,
  executeListLinearTeams,
} from "../create-linear-issue";

describe("executeCreateLinearIssue", () => {
  it("reports that Linear issue creation lives in the extension", async () => {
    const result = await executeCreateLinearIssue({ apiKey: "test" }, { title: "Bug report" });
    expect(result.error).toContain("Linear issue creation requires the Linear extension");
  });
});

describe("executeListLinearTeams", () => {
  it("returns no teams without the extension", async () => {
    const teams = await executeListLinearTeams({ apiKey: "test" });
    expect(teams).toEqual([]);
  });
});

describe("executeListLinearLabels", () => {
  it("returns no labels without the extension", async () => {
    const labels = await executeListLinearLabels({ apiKey: "test" });
    expect(labels).toEqual([]);
  });
});
