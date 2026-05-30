import { describe, expect, it } from "vitest";
import { evaluateCondition, resolveTemplate } from "../engine";

describe("resolveTemplate", () => {
  it("replaces variables in template", () => {
    const result = resolveTemplate("Hello {{name}}, your score is {{score}}", {
      name: "David",
      score: 42,
    });
    expect(result).toBe("Hello David, your score is 42");
  });

  it("leaves unknown variables as-is", () => {
    const result = resolveTemplate("Hello {{unknown}}", {});
    expect(result).toBe("Hello {{unknown}}");
  });

  it("handles objects as JSON", () => {
    const result = resolveTemplate("Data: {{data}}", { data: { a: 1 } });
    expect(result).toContain('"a":1');
  });
});

describe("evaluateCondition", () => {
  it("evaluates greater than", () => {
    expect(evaluateCondition("{{value}} > 50", { value: 75 })).toBe(true);
    expect(evaluateCondition("{{value}} > 50", { value: 25 })).toBe(false);
  });

  it("evaluates less than", () => {
    expect(evaluateCondition("{{value}} < 100", { value: 50 })).toBe(true);
  });

  it("evaluates equality", () => {
    expect(evaluateCondition("{{status}} == 200", { status: 200 })).toBe(true);
    expect(evaluateCondition("{{status}} != 200", { status: 500 })).toBe(true);
  });

  it("evaluates greater than or equal", () => {
    expect(evaluateCondition("{{score}} >= 80", { score: 80 })).toBe(true);
    expect(evaluateCondition("{{score}} >= 80", { score: 79 })).toBe(false);
  });

  it("truthy check on string", () => {
    expect(evaluateCondition("{{data}}", { data: "some value" })).toBe(true);
    expect(evaluateCondition("{{data}}", { data: "" })).toBe(false);
  });

  it("falsy check on null/false/0", () => {
    expect(evaluateCondition("{{val}}", { val: null })).toBe(false);
    expect(evaluateCondition("{{val}}", { val: false })).toBe(false);
    expect(evaluateCondition("{{val}}", { val: 0 })).toBe(false);
  });
});
