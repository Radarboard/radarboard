export function evaluateCondition(
  left: unknown,
  operator: "lt" | "gt" | "eq" | "neq" | "lte" | "gte",
  right: number | string | boolean
): boolean {
  switch (operator) {
    case "lt":
      return Number(left) < Number(right);
    case "gt":
      return Number(left) > Number(right);
    case "eq":
      return left === right;
    case "neq":
      return left !== right;
    case "lte":
      return Number(left) <= Number(right);
    case "gte":
      return Number(left) >= Number(right);
    default:
      return false;
  }
}
