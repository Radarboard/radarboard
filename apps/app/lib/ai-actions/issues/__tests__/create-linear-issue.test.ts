import { describe, expect, it, vi } from "vitest";

vi.mock("@radarboard/integration-linear/client", () => ({
  createIssue: vi.fn().mockResolvedValue({
    success: true,
    issue: {
      id: "iss-1",
      identifier: "DDD-100",
      title: "Test",
      url: "https://linear.app/issue/DDD-100",
      team: { key: "DDD", name: "Team" },
      state: { name: "Backlog", type: "backlog" },
    },
  }),
  getTeams: vi.fn().mockResolvedValue([{ id: "team-1", name: "Engineering", key: "ENG" }]),
  getLabels: vi.fn().mockResolvedValue([
    { id: "label-1", name: "bug" },
    { id: "label-2", name: "feature" },
  ]),
}));

import {
  executeCreateLinearIssue,
  executeListLinearLabels,
  executeListLinearTeams,
} from "../create-linear-issue";

describe("executeCreateLinearIssue", () => {
  it("delegates to the integration client", async () => {
    const result = await executeCreateLinearIssue({ apiKey: "test" }, { title: "Bug report" });
    expect(result.success).toBe(true);
    expect(result.issue.identifier).toBe("DDD-100");
  });
});

describe("executeListLinearTeams", () => {
  it("returns teams from integration client", async () => {
    const teams = await executeListLinearTeams({ apiKey: "test" });
    expect(teams).toHaveLength(1);
    expect(teams[0].key).toBe("ENG");
  });
});

describe("executeListLinearLabels", () => {
  it("returns labels from integration client", async () => {
    const labels = await executeListLinearLabels({ apiKey: "test" });
    expect(labels).toHaveLength(2);
  });
});
