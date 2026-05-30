const PATH_SEGMENT_PATTERN = /[^.[\]]+|\[(\d+)\]/g;

function parsePath(path: string): Array<string | number> {
  return Array.from(path.matchAll(PATH_SEGMENT_PATTERN)).map((match) => {
    const [, arrayIndex] = match;
    return arrayIndex === undefined ? match[0] : Number(arrayIndex);
  });
}

export function getByPath(input: unknown, path: string): unknown {
  if (!path) return input;

  let current: unknown = input;

  for (const segment of parsePath(path)) {
    if (current == null) {
      return undefined;
    }

    if (Array.isArray(current) && typeof segment === "number") {
      current = current[segment];
      continue;
    }

    if (typeof current === "object") {
      current = (current as Record<string, unknown>)[String(segment)];
      continue;
    }

    return undefined;
  }

  return current;
}
