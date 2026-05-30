import { describe, expect, it } from "vitest";
import { collectViolationsFromSource, shouldCheckFile } from "./check-route-error-responses";

describe("shouldCheckFile", () => {
  it("checks app route files", () => {
    expect(shouldCheckFile("apps/app/app/api/system/license/route.ts")).toBe(true);
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

describe("collectViolationsFromSource", () => {
  it("flags manual NextResponse.json error responses", () => {
    const violations = collectViolationsFromSource(
      "apps/app/modules/example/routes/demo.ts",
      [
        'import { NextResponse } from "next/server";',
        "export function GET() {",
        '  return NextResponse.json({ error: "title is required" }, { status: 400 });',
        "}",
      ].join("\n")
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("Manual NextResponse.json error response");
  });

  it("does not flag successful responses", () => {
    const violations = collectViolationsFromSource(
      "apps/app/modules/example/routes/demo.ts",
      [
        'import { NextResponse } from "next/server";',
        "export function GET() {",
        '  return NextResponse.json({ success: true, messages: [] });',
        "}",
      ].join("\n")
    );

    expect(violations).toEqual([]);
  });

  it("does not flag data payloads that happen to include an error field", () => {
    const violations = collectViolationsFromSource(
      "apps/app/app/api/system/license/route.ts",
      [
        'import { NextResponse } from "next/server";',
        "export function GET() {",
        '  return NextResponse.json({ active: true, plan: \"pro\", error: null });',
        "}",
      ].join("\n")
    );

    expect(violations).toEqual([]);
  });
});
