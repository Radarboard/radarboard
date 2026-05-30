import type {
  DebugConfig,
  FeaturePreferencesConfig,
  IntegrationConnectionsConfig,
  LlmConfig,
  ProjectIntegrationsConfig,
  RoutingConfig,
  SettingsRepository,
  SupabaseConfig,
  WidgetLayoutConfig,
} from "@radarboard/types/database";
import type { ProjectContextMap } from "@radarboard/types/project-context";

/**
 * Supabase-backed settings repository. Uses PostgREST API.
 *
 * Requires table in Supabase:
 * - user_settings (id text PK, project_order text, updated_at int8)
 */
export class SupabaseSettingsRepository implements SettingsRepository {
  private url: string;
  private headers: Record<string, string>;

  constructor(config: SupabaseConfig) {
    this.url = `${config.url}/rest/v1`;
    this.headers = {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    };
  }

  private isMissingColumnResponseError(status: number): boolean {
    return status === 400 || status === 404;
  }

  async getProjectOrder(): Promise<string[]> {
    const res = await fetch(`${this.url}/user_settings?id=eq.default&select=project_order`, {
      headers: this.headers,
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as Array<{ project_order: string | null }>;
    const row = rows[0];
    if (!row?.project_order) return [];
    return JSON.parse(row.project_order) as string[];
  }

  async setProjectOrder(order: string[]): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const body = {
      id: "default",
      project_order: JSON.stringify(order),
      updated_at: now,
    };

    await fetch(`${this.url}/user_settings`, {
      method: "POST",
      headers: {
        ...this.headers,
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(body),
    });
  }

  async getWidgetLayout(): Promise<WidgetLayoutConfig | null> {
    const res = await fetch(`${this.url}/user_settings?id=eq.default&select=widget_layout`, {
      headers: this.headers,
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ widget_layout: string | null }>;
    const row = rows[0];
    if (!row?.widget_layout) return null;
    return JSON.parse(row.widget_layout) as WidgetLayoutConfig;
  }

  async setWidgetLayout(config: WidgetLayoutConfig): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const body = {
      id: "default",
      widget_layout: JSON.stringify(config),
      updated_at: now,
    };

    await fetch(`${this.url}/user_settings`, {
      method: "POST",
      headers: {
        ...this.headers,
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(body),
    });
  }

  async getProjectIntegrations(): Promise<ProjectIntegrationsConfig> {
    const res = await fetch(`${this.url}/user_settings?id=eq.default&select=project_integrations`, {
      headers: this.headers,
    });
    if (!res.ok) return {};
    const rows = (await res.json()) as Array<{ project_integrations: string | null }>;
    const row = rows[0];
    if (!row?.project_integrations) return {};
    return JSON.parse(row.project_integrations) as ProjectIntegrationsConfig;
  }

  async setProjectIntegrations(config: ProjectIntegrationsConfig): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const body = {
      id: "default",
      project_integrations: JSON.stringify(config),
      updated_at: now,
    };

    await fetch(`${this.url}/user_settings`, {
      method: "POST",
      headers: {
        ...this.headers,
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(body),
    });
  }

  async getIntegrationConnections(): Promise<IntegrationConnectionsConfig> {
    const res = await fetch(
      `${this.url}/user_settings?id=eq.default&select=integration_connections`,
      {
        headers: this.headers,
      }
    );
    if (!res.ok) {
      if (this.isMissingColumnResponseError(res.status)) return [];
      return [];
    }
    const rows = (await res.json()) as Array<{ integration_connections: string | null }>;
    const row = rows[0];
    if (!row?.integration_connections) return [];
    return JSON.parse(row.integration_connections) as IntegrationConnectionsConfig;
  }

  async setIntegrationConnections(config: IntegrationConnectionsConfig): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const body = {
      id: "default",
      integration_connections: JSON.stringify(config),
      updated_at: now,
    };

    await fetch(`${this.url}/user_settings`, {
      method: "POST",
      headers: {
        ...this.headers,
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(body),
    });
  }

  async getProjectContextMap(): Promise<ProjectContextMap> {
    const res = await fetch(`${this.url}/user_settings?id=eq.default&select=project_context_map`, {
      headers: this.headers,
    });
    if (!res.ok) return {};
    const rows = (await res.json()) as Array<{ project_context_map: string | null }>;
    const row = rows[0];
    if (!row?.project_context_map) return {};
    return JSON.parse(row.project_context_map) as ProjectContextMap;
  }

  async setProjectContextMap(ctx: ProjectContextMap): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const body = {
      id: "default",
      project_context_map: JSON.stringify(ctx),
      updated_at: now,
    };

    await fetch(`${this.url}/user_settings`, {
      method: "POST",
      headers: {
        ...this.headers,
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(body),
    });
  }

  async getLlmConfig(): Promise<LlmConfig> {
    const res = await fetch(`${this.url}/user_settings?id=eq.default&select=llm_config`, {
      headers: this.headers,
    });
    const rows = (await res.json()) as Array<{ llm_config?: string }>;
    const raw = rows[0]?.llm_config;
    if (!raw) return {};
    return JSON.parse(raw) as LlmConfig;
  }

  async setLlmConfig(config: LlmConfig): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await fetch(`${this.url}/user_settings`, {
      method: "POST",
      headers: { ...this.headers, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ id: "default", llm_config: JSON.stringify(config), updated_at: now }),
    });
  }

  async getDebugConfig(): Promise<DebugConfig> {
    const res = await fetch(`${this.url}/user_settings?id=eq.default&select=debug_config`, {
      headers: this.headers,
    });
    const rows = (await res.json()) as Array<{ debug_config?: string }>;
    const raw = rows[0]?.debug_config;
    if (!raw) return {};
    return JSON.parse(raw) as DebugConfig;
  }

  async setDebugConfig(config: DebugConfig): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await fetch(`${this.url}/user_settings`, {
      method: "POST",
      headers: { ...this.headers, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        id: "default",
        debug_config: JSON.stringify(config),
        updated_at: now,
      }),
    });
  }

  async getRoutingConfig(): Promise<RoutingConfig> {
    const res = await fetch(`${this.url}/user_settings?id=eq.default&select=routing_config`, {
      headers: this.headers,
    });
    const rows = (await res.json()) as Array<{ routing_config?: string }>;
    const raw = rows[0]?.routing_config;
    if (!raw) return { rules: [] };
    return JSON.parse(raw) as RoutingConfig;
  }

  async setRoutingConfig(config: RoutingConfig): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await fetch(`${this.url}/user_settings`, {
      method: "POST",
      headers: { ...this.headers, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        id: "default",
        routing_config: JSON.stringify(config),
        updated_at: now,
      }),
    });
  }

  async getWorkflows(): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.url}/user_settings?id=eq.default&select=workflows`, {
      headers: this.headers,
    });
    if (!res.ok) {
      if (this.isMissingColumnResponseError(res.status)) return {};
      return {};
    }
    const rows = (await res.json()) as Array<{ workflows?: string }>;
    const raw = rows[0]?.workflows;
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, unknown>;
  }

  async setWorkflows(workflows: Record<string, unknown>): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await fetch(`${this.url}/user_settings`, {
      method: "POST",
      headers: { ...this.headers, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        id: "default",
        workflows: JSON.stringify(workflows),
        updated_at: now,
      }),
    });
  }

  async getFeaturePreferences(): Promise<FeaturePreferencesConfig> {
    const res = await fetch(`${this.url}/user_settings?id=eq.default&select=feature_preferences`, {
      headers: this.headers,
    });
    if (!res.ok) {
      if (this.isMissingColumnResponseError(res.status)) return {};
      return {};
    }
    const rows = (await res.json()) as Array<{ feature_preferences?: string }>;
    const raw = rows[0]?.feature_preferences;
    if (!raw) return {};
    return JSON.parse(raw) as FeaturePreferencesConfig;
  }

  async setFeaturePreferences(prefs: FeaturePreferencesConfig): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await fetch(`${this.url}/user_settings`, {
      method: "POST",
      headers: { ...this.headers, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        id: "default",
        feature_preferences: JSON.stringify(prefs),
        updated_at: now,
      }),
    });
  }

  async getUserPlan(): Promise<string | null> {
    const res = await fetch(`${this.url}/user_settings?id=eq.default&select=user_plan`, {
      headers: this.headers,
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ user_plan?: string }>;
    return rows[0]?.user_plan ?? null;
  }

  async setUserPlan(plan: string): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await fetch(`${this.url}/user_settings`, {
      method: "POST",
      headers: { ...this.headers, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ id: "default", user_plan: plan, updated_at: now }),
    });
  }

  async getLicenseKey(): Promise<string | null> {
    const res = await fetch(`${this.url}/user_settings?id=eq.default&select=license_key`, {
      headers: this.headers,
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ license_key?: string }>;
    return rows[0]?.license_key ?? null;
  }

  async setLicenseKey(key: string): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await fetch(`${this.url}/user_settings`, {
      method: "POST",
      headers: { ...this.headers, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ id: "default", license_key: key, updated_at: now }),
    });
  }
}
