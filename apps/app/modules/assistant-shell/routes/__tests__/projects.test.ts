import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSettingsRepo = {
  getProjectContextMap: vi.fn(),
};

vi.mock("@/db/repository", () => ({
  getSettingsRepo: () => mockSettingsRepo,
}));

import { handleGetChatProjects as GET } from "@/modules/assistant-shell/routes/projects";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/chat/projects", () => {
  it("returns array of project slugs from context map", async () => {
    mockSettingsRepo.getProjectContextMap.mockResolvedValue({
      "my-app": { goals: [] },
      "other-app": { goals: [] },
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(["my-app", "other-app"]);
  });

  it("returns empty array when context map is empty", async () => {
    mockSettingsRepo.getProjectContextMap.mockResolvedValue({});

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual([]);
  });

  it("returns empty array when repo throws", async () => {
    mockSettingsRepo.getProjectContextMap.mockRejectedValue(new Error("DB error"));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual([]);
  });
});
