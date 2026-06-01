import { describe, expect, it } from "vitest";
import { handleGetStatusPageHealth as GET } from "@/modules/plugin-shell/routes/status-page-health";

describe("GET /api/plugins/status-page/project-health", () => {
  it("returns 404 when the status page plugin is not installed", async () => {
    const req = new Request(
      "http://localhost/api/status-page/project-health?projectSlug=radarboard&platformId=web"
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toContain("Status page plugin is not installed");
  });
});
