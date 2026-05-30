import type {
  DebugConfig,
  FeaturePreferencesConfig,
  IntegrationConnectionsConfig,
  LlmConfig,
  PlanetscaleConfig,
  ProjectIntegrationsConfig,
  RoutingConfig,
  SettingsRepository,
  WidgetLayoutConfig,
} from "@radarboard/types/database";
import type { ProjectContextMap } from "@radarboard/types/project-context";

/**
 * PlanetScale-backed settings repository.
 *
 * Requires table:
 * - user_settings (id varchar(255) PK, project_order text, updated_at bigint)
 */
export class PlanetscaleSettingsRepository implements SettingsRepository {
  private config: PlanetscaleConfig;

  constructor(config: PlanetscaleConfig) {
    this.config = config;
  }

  private isMissingColumnError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes("Unknown column");
  }

  private async query(
    sql: string,
    args: unknown[] = []
  ): Promise<{ rows: Record<string, unknown>[] }> {
    const res = await fetch(`https://${this.config.host}/v1/query`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.config.username}:${this.config.password}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql, args }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`PlanetScale query failed: ${res.status} ${text}`);
    }

    const data = (await res.json()) as { rows?: Record<string, unknown>[] };
    return { rows: data.rows ?? [] };
  }

  async getProjectOrder(): Promise<string[]> {
    const result = await this.query("SELECT project_order FROM user_settings WHERE id = ?", [
      "default",
    ]);
    const row = result.rows[0];
    if (!row?.project_order) return [];
    return JSON.parse(row.project_order as string) as string[];
  }

  async setProjectOrder(order: string[]): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.query(
      `INSERT INTO user_settings (id, project_order, updated_at)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE project_order = VALUES(project_order), updated_at = VALUES(updated_at)`,
      ["default", JSON.stringify(order), now]
    );
  }

  async getWidgetLayout(): Promise<WidgetLayoutConfig | null> {
    const result = await this.query("SELECT widget_layout FROM user_settings WHERE id = ?", [
      "default",
    ]);
    const row = result.rows[0];
    if (!row?.widget_layout) return null;
    return JSON.parse(row.widget_layout as string) as WidgetLayoutConfig;
  }

  async setWidgetLayout(config: WidgetLayoutConfig): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.query(
      `INSERT INTO user_settings (id, widget_layout, updated_at)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE widget_layout = VALUES(widget_layout), updated_at = VALUES(updated_at)`,
      ["default", JSON.stringify(config), now]
    );
  }

  async getProjectIntegrations(): Promise<ProjectIntegrationsConfig> {
    const result = await this.query("SELECT project_integrations FROM user_settings WHERE id = ?", [
      "default",
    ]);
    const row = result.rows[0];
    if (!row?.project_integrations) return {};
    return JSON.parse(row.project_integrations as string) as ProjectIntegrationsConfig;
  }

  async setProjectIntegrations(config: ProjectIntegrationsConfig): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.query(
      `INSERT INTO user_settings (id, project_integrations, updated_at)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE project_integrations = VALUES(project_integrations), updated_at = VALUES(updated_at)`,
      ["default", JSON.stringify(config), now]
    );
  }

  async getIntegrationConnections(): Promise<IntegrationConnectionsConfig> {
    try {
      const result = await this.query(
        "SELECT integration_connections FROM user_settings WHERE id = ?",
        ["default"]
      );
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
    await this.query(
      `INSERT INTO user_settings (id, integration_connections, updated_at)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE integration_connections = VALUES(integration_connections), updated_at = VALUES(updated_at)`,
      ["default", JSON.stringify(config), now]
    );
  }

  async getProjectContextMap(): Promise<ProjectContextMap> {
    const result = await this.query("SELECT project_context_map FROM user_settings WHERE id = ?", [
      "default",
    ]);
    const row = result.rows[0];
    if (!row?.project_context_map) return {};
    return JSON.parse(row.project_context_map as string) as ProjectContextMap;
  }

  async setProjectContextMap(ctx: ProjectContextMap): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.query(
      `INSERT INTO user_settings (id, project_context_map, updated_at)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE project_context_map = VALUES(project_context_map), updated_at = VALUES(updated_at)`,
      ["default", JSON.stringify(ctx), now]
    );
  }

  async getLlmConfig(): Promise<LlmConfig> {
    const result = await this.query("SELECT llm_config FROM user_settings WHERE id = ?", [
      "default",
    ]);
    const row = result.rows[0];
    if (!row?.llm_config) return {};
    return JSON.parse(row.llm_config as string) as LlmConfig;
  }

  async setLlmConfig(config: LlmConfig): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.query(
      `INSERT INTO user_settings (id, llm_config, updated_at)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE llm_config = VALUES(llm_config), updated_at = VALUES(updated_at)`,
      ["default", JSON.stringify(config), now]
    );
  }

  async getDebugConfig(): Promise<DebugConfig> {
    const result = await this.query("SELECT debug_config FROM user_settings WHERE id = ?", [
      "default",
    ]);
    const row = result.rows[0];
    if (!row?.debug_config) return {};
    return JSON.parse(row.debug_config as string) as DebugConfig;
  }

  async setDebugConfig(config: DebugConfig): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.query(
      `INSERT INTO user_settings (id, debug_config, updated_at)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE debug_config = VALUES(debug_config), updated_at = VALUES(updated_at)`,
      ["default", JSON.stringify(config), now]
    );
  }

  async getRoutingConfig(): Promise<RoutingConfig> {
    const result = await this.query("SELECT routing_config FROM user_settings WHERE id = ?", [
      "default",
    ]);
    const row = result.rows[0];
    if (!row?.routing_config) return { rules: [] };
    return JSON.parse(row.routing_config as string) as RoutingConfig;
  }

  async setRoutingConfig(config: RoutingConfig): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.query(
      `INSERT INTO user_settings (id, routing_config, updated_at)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE routing_config = VALUES(routing_config), updated_at = VALUES(updated_at)`,
      ["default", JSON.stringify(config), now]
    );
  }

  async getWorkflows(): Promise<Record<string, unknown>> {
    try {
      const result = await this.query("SELECT workflows FROM user_settings WHERE id = ?", [
        "default",
      ]);
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
    await this.query(
      `INSERT INTO user_settings (id, workflows, updated_at)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE workflows = VALUES(workflows), updated_at = VALUES(updated_at)`,
      ["default", JSON.stringify(workflows), now]
    );
  }

  async getFeaturePreferences(): Promise<FeaturePreferencesConfig> {
    try {
      const result = await this.query(
        "SELECT feature_preferences FROM user_settings WHERE id = ?",
        ["default"]
      );
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
    await this.query(
      `INSERT INTO user_settings (id, feature_preferences, updated_at)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE feature_preferences = VALUES(feature_preferences), updated_at = VALUES(updated_at)`,
      ["default", JSON.stringify(prefs), now]
    );
  }

  async getUserPlan(): Promise<string | null> {
    try {
      const result = await this.query("SELECT user_plan FROM user_settings WHERE id = ?", [
        "default",
      ]);
      return (result.rows[0]?.user_plan as string) ?? null;
    } catch (error) {
      if (this.isMissingColumnError(error)) return null;
      throw error;
    }
  }

  async setUserPlan(plan: string): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.query(
      `INSERT INTO user_settings (id, user_plan, updated_at)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE user_plan = VALUES(user_plan), updated_at = VALUES(updated_at)`,
      ["default", plan, now]
    );
  }

  async getLicenseKey(): Promise<string | null> {
    try {
      const result = await this.query("SELECT license_key FROM user_settings WHERE id = ?", [
        "default",
      ]);
      return (result.rows[0]?.license_key as string) ?? null;
    } catch (error) {
      if (this.isMissingColumnError(error)) return null;
      throw error;
    }
  }

  async setLicenseKey(key: string): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.query(
      `INSERT INTO user_settings (id, license_key, updated_at)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE license_key = VALUES(license_key), updated_at = VALUES(updated_at)`,
      ["default", key, now]
    );
  }
}
