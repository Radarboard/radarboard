export function formatPackagePatterns(value: unknown): string {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").join("\n")
    : "";
}

export function parsePackagePatterns(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    )
  );
}

export function resolvePackagePatternDraft(
  value: unknown,
  currentDraft: string,
  isEditing: boolean
): string {
  return isEditing ? currentDraft : formatPackagePatterns(value);
}

export function finalizePackagePatternDraft(value: string) {
  const patterns = parsePackagePatterns(value);
  return {
    draft: formatPackagePatterns(patterns),
    patterns,
  };
}
