import { describe, expect, it } from "vitest";
import {
  collectViolationsFromSource,
  resolveTargetFiles,
  shouldCheckFile,
} from "./check-route-zod-boundaries";

describe("shouldCheckFile", () => {
  it("checks app route files", () => {
    expect(shouldCheckFile("apps/app/app/api/system/license/route.ts")).toBe(true);
  });

  it("checks marketing route files", () => {
    expect(shouldCheckFile("apps/marketing/app/api/waitlist/route.ts")).toBe(true);
  });

  it("checks module route handlers", () => {
    expect(shouldCheckFile("apps/app/modules/assistant-shell/routes/memory.ts")).toBe(true);
  });

  it("skips tests and stories", () => {
    expect(shouldCheckFile("apps/app/modules/assistant-shell/routes/__tests__/memory.test.ts")).toBe(
      false
    );
    expect(shouldCheckFile("apps/app/components/foo/__stories__/bar.stories.tsx")).toBe(false);
  });
});

describe("resolveTargetFiles", () => {
  it("returns staged route files only when file args are provided", () => {
    expect(
      resolveTargetFiles([
        "apps/app/modules/assistant-shell/routes/memory.ts",
        "apps/app/components/foo.tsx",
        "apps/marketing/app/api/waitlist/route.ts",
      ])
    ).toEqual([
      "apps/app/modules/assistant-shell/routes/memory.ts",
      "apps/marketing/app/api/waitlist/route.ts",
    ]);
  });
});

describe("collectViolationsFromSource", () => {
  it("flags request bodies that are only type-cast", () => {
    const violations = collectViolationsFromSource(
      "apps/app/app/api/assistant/workflows/route.ts",
      [
        "export async function POST(request: Request) {",
        "  const body = (await request.json()) as { name: string };",
        "  return Response.json(body);",
        "}",
      ].join("\n")
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("request.json()");
  });

  it("does not flag request bodies validated with safeParse", () => {
    const violations = collectViolationsFromSource(
      "apps/marketing/app/api/waitlist/route.ts",
      [
        'import { z } from "zod";',
        "const schema = z.object({ email: z.string().email() });",
        "export async function POST(request: Request) {",
        "  const body = await request.json();",
        "  const parsed = schema.safeParse(body);",
        "  return Response.json(parsed.success);",
        "}",
      ].join("\n")
    );

    expect(violations).toEqual([]);
  });

  it("does not flag assignment-based body validation", () => {
    const violations = collectViolationsFromSource(
      "apps/marketing/app/api/waitlist/route.ts",
      [
        'import { z } from "zod";',
        "const schema = z.object({ email: z.string().email() });",
        "export async function POST(request: Request) {",
        "  let body: unknown;",
        "  body = await request.json();",
        "  const parsed = schema.safeParse(body);",
        "  return Response.json(parsed.success);",
        "}",
      ].join("\n")
    );

    expect(violations).toEqual([]);
  });

  it("flags manual search param reads", () => {
    const violations = collectViolationsFromSource(
      "apps/app/app/api/assistant/workflows/route.ts",
      [
        "export async function DELETE(request: Request) {",
        "  const { searchParams } = new URL(request.url);",
        '  const id = searchParams.get("id");',
        '  if (!id) throw new Error("missing");',
        "  return Response.json({ id });",
        "}",
      ].join("\n")
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("Search params");
  });

  it("does not flag parseSearchParams helper usage", () => {
    const violations = collectViolationsFromSource(
      "apps/app/app/api/plugins/data/list/route.ts",
      [
        "export async function GET(request: NextRequest) {",
        "  const parsed = parseSearchParams(request.nextUrl.searchParams, ListSchema);",
        "  if (!parsed.ok) return parsed.response;",
        "  return Response.json(parsed.data);",
        "}",
      ].join("\n")
    );

    expect(violations).toEqual([]);
  });

  it("does not flag search params validated via safeParse", () => {
    const violations = collectViolationsFromSource(
      "apps/app/app/api/plugins/status-page/project-health/route.ts",
      [
        'import { z } from "zod";',
        "const QuerySchema = z.object({ id: z.string().min(1) });",
        "export async function GET(request: Request) {",
        "  const url = new URL(request.url);",
        "  const parsed = QuerySchema.safeParse({",
        '    id: url.searchParams.get("id"),',
        "  });",
        "  return Response.json(parsed.success);",
        "}",
      ].join("\n")
    );

    expect(violations).toEqual([]);
  });

  it("does not flag Object.fromEntries search params validated later", () => {
    const violations = collectViolationsFromSource(
      "apps/app/modules/example/routes/demo.ts",
      [
        'import { z } from "zod";',
        "const QuerySchema = z.object({ page: z.coerce.number().default(1) });",
        "export async function GET(request: Request) {",
        "  const { searchParams } = new URL(request.url);",
        "  const raw = Object.fromEntries(searchParams.entries());",
        "  const parsed = QuerySchema.safeParse(raw);",
        "  return Response.json(parsed.success);",
        "}",
      ].join("\n")
    );

    expect(violations).toEqual([]);
  });

  it("flags direct formData reads", () => {
    const violations = collectViolationsFromSource(
      "apps/app/modules/auth-shell/routes/mcp-oauth/authorize.ts",
      [
        "export async function POST(request: Request) {",
        "  const formData = await request.formData();",
        '  return Response.json({ action: formData.get("action") });',
        "}",
      ].join("\n")
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("request.formData()");
  });

  it("flags urlencoded request bodies parsed without validation", () => {
    const violations = collectViolationsFromSource(
      "apps/app/modules/auth-shell/routes/mcp-oauth/token.ts",
      [
        "export async function POST(request: Request) {",
        "  const text = await request.text();",
        "  const params = Object.fromEntries(new URLSearchParams(text));",
        "  return Response.json(params);",
        "}",
      ].join("\n")
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("URL-encoded request body");
  });
});
