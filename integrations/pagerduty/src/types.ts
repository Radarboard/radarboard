/**
 * PagerDuty — Data types
 */

export interface PagerDutyConfig {
  apiToken: string;
}

export interface PagerDutyIncident {
  id: string;
  incident_number: number;
  title: string;
  status: "triggered" | "acknowledged" | "resolved";
  urgency: "high" | "low";
  created_at: string;
  last_status_change_at: string;
  html_url: string;
  service: {
    id: string;
    summary: string;
  };
  assignees: Array<{ summary: string }>;
}

export interface PagerDutyService {
  id: string;
  name: string;
  status: "active" | "warning" | "critical" | "maintenance" | "disabled";
  created_at: string;
  html_url: string;
}

export interface PagerDutyOnCall {
  user: { summary: string };
  schedule: { summary: string } | null;
  escalation_level: number;
  start: string;
  end: string;
}
