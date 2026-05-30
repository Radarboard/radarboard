type SearchParamsLike = { toString(): string } | string | null | undefined;

export function getDashboardPath(projectSlug: string | null): string {
  return projectSlug ? `/projects/${encodeURIComponent(projectSlug)}` : "/";
}

function toSearchParams(searchParams?: SearchParamsLike): URLSearchParams {
  const query =
    typeof searchParams === "string"
      ? searchParams.replace(/^\?/, "")
      : (searchParams?.toString() ?? "");
  return new URLSearchParams(query);
}

export function updateDashboardSearch(
  searchParams: SearchParamsLike,
  updates: Record<string, string | null | undefined>,
  clearKeys: string[] = []
): string {
  const params = toSearchParams(searchParams);

  for (const key of clearKeys) {
    params.delete(key);
  }

  for (const [key, value] of Object.entries(updates)) {
    if (!value) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  }

  return params.toString();
}

export function getDashboardHref(
  projectSlug: string | null,
  searchParams?: SearchParamsLike
): string {
  const path = getDashboardPath(projectSlug);
  const query = typeof searchParams === "string" ? searchParams : (searchParams?.toString() ?? "");

  return query ? `${path}?${query}` : path;
}
