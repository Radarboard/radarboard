export type ServiceStatus = "operational" | "degraded" | "outage" | "unknown";
export type StatusSourceKind = "standalone" | "integration" | "project";

export interface StatusSource {
  id: string;
  kind: StatusSourceKind;
  name: string;
  url: string;
  statusPageUrl?: string;
  status: ServiceStatus;
  lastCheckedAt: string;
  addedAt: string;
  alertsEnabled?: boolean;
  remoteUpdatedAt?: string | null;
  projectSlug?: string | null;
  projectName?: string | null;
  platformId?: string | null;
  platformName?: string | null;
  integrationKey?: string | null;
  linkedTargetCount?: number | null;
  linkedTargetSummary?: string | null;
  muted?: boolean;
  disabled?: boolean;
}

function normalizeSourceKind(kind?: StatusSourceKind): StatusSourceKind {
  if (kind === "integration" || kind === "project") return kind;
  return "standalone";
}

export function normalizeStatusSource(source: StatusSource): StatusSource {
  const kind = normalizeSourceKind(source.kind);
  const muted = source.muted ?? (kind === "standalone" ? source.alertsEnabled === false : false);
  return {
    ...source,
    kind,
    alertsEnabled: kind === "standalone" ? !muted : undefined,
    projectSlug: source.projectSlug ?? null,
    projectName: source.projectName ?? null,
    platformId: source.platformId ?? null,
    platformName: source.platformName ?? null,
    integrationKey: source.integrationKey ?? null,
    remoteUpdatedAt: source.remoteUpdatedAt ?? null,
    linkedTargetCount: source.linkedTargetCount ?? null,
    linkedTargetSummary: source.linkedTargetSummary ?? null,
    muted,
    disabled: source.disabled ?? false,
  };
}
