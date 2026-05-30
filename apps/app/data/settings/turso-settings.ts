import { createClient } from "@libsql/client";
import type {
  DebugConfig,
  FeaturePreferencesConfig,
  IntegrationConnectionsConfig,
  LlmConfig,
  ProjectIntegrationsConfig,
  RoutingConfig,
  SettingsRepository,
  TursoConfig,
  WidgetLayoutConfig,
} from "@radarboard/types/database";
import type { ProjectContextMap } from "@radarboard/types/project-context";

export class TursoSettingsRepository implements SettingsRepository {
  private client: ReturnType<typeof createClient>;

  constructor(config: TursoConfig) {
    this.client = createClient({ url: config.url, authToken: config.authToken });
  }

  private isMissingColumnError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes("no such column") || message.includes("does not exist");
  }

  async getProjectOrder(): Promise<string[]> {
    const result = await this.client.execute({
      sql: "SELECT project_order FROM user_settings WHERE id = ?",
      args: ["default"],
    });
    const row = result.rows[0];
    if (!row?.project_order) return [];
    return JSON.parse(row.project_order as string) as string[];
  }

  async setProjectOrder(order: string[]): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.client.execute({
      sql: `INSERT INTO user_settings (id, project_order, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET project_order = ?, updated_at = ?`,
      args: ["default", JSON.stringify(order), now, JSON.stringify(order), now],
    });
  }

  async getWidgetLayout(): Promise<WidgetLayoutConfig | null> {
    const result = await this.client.execute({
      sql: "SELECT widget_layout FROM user_settings WHERE id = ?",
      args: ["default"],
    });
    const row = result.rows[0];
    if (!row?.widget_layout) return null;
    return JSON.parse(row.widget_layout as string) as WidgetLayoutConfig;
  }

  async setWidgetLayout(config: WidgetLayoutConfig): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.client.execute({
      sql: `INSERT INTO user_settings (id, widget_layout, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET widget_layout = ?, updated_at = ?`,
      args: ["default", JSON.stringify(config), now, JSON.stringify(config), now],
    });
  }

  async getProjectIntegrations(): Promise<ProjectIntegrationsConfig> {
    const result = await this.client.execute({
      sql: "SELECT project_integrations FROM user_settings WHERE id = ?",
      args: ["default"],
    });
    const row = result.rows[0];
    if (!row?.project_integrations) return {};
    return JSON.parse(row.project_integrations as string) as ProjectIntegrationsConfig;
  }

  async setProjectIntegrations(config: ProjectIntegrationsConfig): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.client.execute({
      sql: `INSERT INTO user_settings (id, project_integrations, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET project_integrations = ?, updated_at = ?`,
      args: ["default", JSON.stringify(config), now, JSON.stringify(config), now],
    });
  }

  async getIntegrationConnections(): Promise<IntegrationConnectionsConfig> {
    try {
      const result = await this.client.execute({
        sql: "SELECT integration_connections FROM user_settings WHERE id = ?",
        args: ["default"],
      });
      const row = result.rows[0];
      if (!row?.integration_connections) return [];
      return JSON.parse(row.integration_connections as string) as IntegrationConnectionsConfig;
    } catch (error) {
      if (this.isMissingColumnError(error)) return [];
      throw error;
    }
  }

  async setIntegrationConnections(config: IntegrationConnectionsConfig): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.client.execute({
      sql: `INSERT INTO user_settings (id, integration_connections, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET integration_connections = ?, updated_at = ?`,
      args: ["default", JSON.stringify(config), now, JSON.stringify(config), now],
    });
  }

  async getProjectContextMap(): Promise<ProjectContextMap> {
    const result = await this.client.execute({
      sql: "SELECT project_context_map FROM user_settings WHERE id = ?",
      args: ["default"],
    });
    const row = result.rows[0];
    if (!row?.project_context_map) return {};
    return JSON.parse(row.project_context_map as string) as ProjectContextMap;
  }

  async setProjectContextMap(ctx: ProjectContextMap): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.client.execute({
      sql: `INSERT INTO user_settings (id, project_context_map, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET project_context_map = ?, updated_at = ?`,
      args: ["default", JSON.stringify(ctx), now, JSON.stringify(ctx), now],
    });
  }

  async getLlmConfig(): Promise<LlmConfig> {
    const result = await this.client.execute({
      sql: "SELECT llm_config FROM user_settings WHERE id = ?",
      args: ["default"],
    });
    const row = result.rows[0];
    if (!row?.llm_config) return {};
    return JSON.parse(row.llm_config as string) as LlmConfig;
  }

  async setLlmConfig(config: LlmConfig): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.client.execute({
      sql: `INSERT INTO user_settings (id, llm_config, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET llm_config = ?, updated_at = ?`,
      args: ["default", JSON.stringify(config), now, JSON.stringify(config), now],
    });
  }

  async getDebugConfig(): Promise<DebugConfig> {
    const result = await this.client.execute({
      sql: "SELECT debug_config FROM user_settings WHERE id = ?",
      args: ["default"],
    });
    const row = result.rows[0];
    if (!row?.debug_config) return {};
    return JSON.parse(row.debug_config as string) as DebugConfig;
  }

  async setDebugConfig(config: DebugConfig): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.client.execute({
      sql: `INSERT INTO user_settings (id, debug_config, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET debug_config = ?, updated_at = ?`,
      args: ["default", JSON.stringify(config), now, JSON.stringify(config), now],
    });
  }

  async getRoutingConfig(): Promise<RoutingConfig> {
    const result = await this.client.execute({
      sql: "SELECT routing_config FROM user_settings WHERE id = ?",
      args: ["default"],
    });
    const row = result.rows[0];
    if (!row?.routing_config) return { rules: [] };
    return JSON.parse(row.routing_config as string) as RoutingConfig;
  }

  async setRoutingConfig(config: RoutingConfig): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.client.execute({
      sql: `INSERT INTO user_settings (id, routing_config, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET routing_config = ?, updated_at = ?`,
      args: ["default", JSON.stringify(config), now, JSON.stringify(config), now],
    });
  }

  async getWorkflows(): Promise<Record<string, unknown>> {
    try {
      const result = await this.client.execute({
        sql: "SELECT workflows FROM user_settings WHERE id = ?",
        args: ["default"],
      });
      const row = result.rows[0];
      if (!row?.workflows) return {};
      return JSON.parse(row.workflows as string) as Record<string, unknown>;
    } catch (error) {
      if (this.isMissingColumnError(error)) return {};
      throw error;
    }
  }

  async setWorkflows(workflows: Record<string, unknown>): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.client.execute({
      sql: `INSERT INTO user_settings (id, workflows, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET workflows = ?, updated_at = ?`,
      args: ["default", JSON.stringify(workflows), now, JSON.stringify(workflows), now],
    });
  }

  async getFeaturePreferences(): Promise<FeaturePreferencesConfig> {
    try {
      const result = await this.client.execute({
        sql: "SELECT feature_preferences FROM user_settings WHERE id = ?",
        args: ["default"],
      });
      const row = result.rows[0];
      if (!row?.feature_preferences) return {};
      return JSON.parse(row.feature_preferences as string) as FeaturePreferencesConfig;
    } catch (error) {
      if (this.isMissingColumnError(error)) return {};
      throw error;
    }
  }

  async setFeaturePreferences(prefs: FeaturePreferencesConfig): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.client.execute({
      sql: `INSERT INTO user_settings (id, feature_preferences, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET feature_preferences = ?, updated_at = ?`,
      args: ["default", JSON.stringify(prefs), now, JSON.stringify(prefs), now],
    });
  }

  async getUserPlan(): Promise<string | null> {
    try {
      const result = await this.client.execute({
        sql: "SELECT user_plan FROM user_settings WHERE id = ?",
        args: ["default"],
      });
      return (result.rows[0]?.user_plan as string) ?? null;
    } catch (error) {
      if (this.isMissingColumnError(error)) return null;
      throw error;
    }
  }

  async setUserPlan(plan: string): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.client.execute({
      sql: `INSERT INTO user_settings (id, user_plan, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET user_plan = ?, updated_at = ?`,
      args: ["default", plan, now, plan, now],
    });
  }

  async getLicenseKey(): Promise<string | null> {
    try {
      const result = await this.client.execute({
        sql: "SELECT license_key FROM user_settings WHERE id = ?",
        args: ["default"],
      });
      return (result.rows[0]?.license_key as string) ?? null;
    } catch (error) {
      if (this.isMissingColumnError(error)) return null;
      throw error;
    }
  }

  async setLicenseKey(key: string): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.client.execute({
      sql: `INSERT INTO user_settings (id, license_key, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET license_key = ?, updated_at = ?`,
      args: ["default", key, now, key, now],
    });
  }
}
