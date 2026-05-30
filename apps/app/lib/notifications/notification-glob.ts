function escapeRegex(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

export function matchesNotificationGlob(value: string, pattern: string): boolean {
  if (pattern === "*") return true;
  const regex = new RegExp(`^${escapeRegex(pattern).replace(/\*/g, ".*")}$`);
  return regex.test(value);
}

export function matchesAnyNotificationGlob(value: string, patterns: string[]): boolean {
  return patterns.some((pattern) => matchesNotificationGlob(value, pattern));
}
