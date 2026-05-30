/**
 * BetterStack — Data types
 *
 * Config and API response types for the BetterStack Uptime REST API.
 */

export interface BetterStackConfig {
  apiToken: string;
}

export interface BetterStackMonitor {
  id: string;
  type: "monitor";
  attributes: {
    url: string;
    pronounceable_name: string;
    monitor_type: "status" | "keyword" | "ping" | "tcp" | "udp" | "smtp" | "pop" | "imap";
    status: "up" | "down" | "validating" | "pending" | "maintenance" | "paused";
    last_checked_at: string;
    check_frequency: number;
    response_times: { region: string; response_time_ms: number }[];
    paused: boolean;
    created_at: string;
    updated_at: string;
  };
}

export interface BetterStackIncident {
  id: string;
  type: "incident";
  attributes: {
    name: string;
    url: string;
    cause: string;
    started_at: string;
    resolved_at: string | null;
    acknowledged_at: string | null;
    call: boolean;
    sms: boolean;
    email: boolean;
    push: boolean;
  };
}

export interface BetterStackHeartbeat {
  id: string;
  type: "heartbeat";
  attributes: {
    name: string;
    period: number;
    grace: number;
    status: "up" | "down" | "paused" | "pending";
    paused: boolean;
    created_at: string;
    updated_at: string;
  };
}
