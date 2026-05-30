/** Webhook relay plugin types. */

export type RelayEventSeverity = "critical" | "warning" | "info" | "success";

export interface RelayEventSummary {
  id: string;
  integration: string;
  type: string;
  severity: RelayEventSeverity;
  title: string;
  body: string | null;
  receivedAt: number;
  metadata?: Record<string, unknown>;
}

export interface RelayStats {
  totalEvents: number;
  byIntegration: Record<string, number>;
  bySeverity: Record<string, number>;
  lastEventAt: number | null;
  pollStatus: "connected" | "unconfigured" | "error";
}
