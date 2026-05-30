/**
 * Workflow engine — pure utility functions for template resolution
 * and condition evaluation. No side effects, no external dependencies.
 */

/**
 * Resolve {{variable}} placeholders in a template string.
 */
export function resolveTemplate(
  template: string,
  variables: Record<string, unknown>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = variables[key];
    if (value === undefined) return `{{${key}}}`;
    return typeof value === "string" ? value : JSON.stringify(value);
  });
}

/**
 * Evaluate a simple condition expression.
 * Format: "{{var}} operator value" or just "{{var}}" (truthy check).
 */
export function evaluateCondition(
  expression: string,
  variables: Record<string, unknown>
): boolean {
  const resolved = resolveTemplate(expression, variables);

  // Try numeric comparison
  const match = resolved.match(/^(.+?)\s*(>=|<=|>|<|==|!=)\s*(.+)$/);
  if (match) {
    const left = Number(match[1]);
    const right = Number(match[3]);
    if (!Number.isNaN(left) && !Number.isNaN(right)) {
      switch (match[2]) {
        case ">": return left > right;
        case "<": return left < right;
        case ">=": return left >= right;
        case "<=": return left <= right;
        case "==": return left === right;
        case "!=": return left !== right;
      }
    }
  }

  // Truthy check
  return Boolean(resolved) && resolved !== "false" && resolved !== "0" && resolved !== "null";
}
