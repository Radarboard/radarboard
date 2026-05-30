/**
 * Resolve a `?service=<id>` URL param into a valid service ID.
 * Returns the service ID if it matches a known service, otherwise null.
 *
 * Pure function — extracted for testability.
 */
export function resolveServiceDeepLink(
  serviceParam: string | null,
  knownServiceIds: Set<string>
): string | null {
  if (!serviceParam || serviceParam.length === 0) return null;
  return knownServiceIds.has(serviceParam) ? serviceParam : null;
}
