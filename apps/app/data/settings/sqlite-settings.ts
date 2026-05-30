import type {
  DebugConfig,
  FeaturePreferencesConfig,
  IntegrationConnectionsConfig,
  LlmConfig,
  ProjectIntegrationsConfig,
  RoutingConfig,
  SettingsRepository,
  WidgetLayoutConfig,
} from "@radarboard/types/database";
import type { ProjectContextMap } from "@radarboard/types/project-context";
import { eq, sql } from "drizzle-orm";
import { ensureDbReady, getDb } from "@/data/core/client";
import { userSettings } from "@/data/core/schema";

const SETTINGS_ID = "default";

export class SqliteSettingsRepository implements SettingsRepository {
  private columnsReady = false;

  /**
   * Ensure DB is initialized and newer columns exist in the table.
   * On first run, this also triggers auto-migration (table creation).
   */
  private async ensureColumns(): Promise<void> {
    if (this.columnsReady) return;
    await ensureDbReady();
    const db = getDb();

    const info = await db.all<{ name: string }>(sql.raw("PRAGMA table_info(user_settings)"));
    const existing = new Set(info.map((row) => row.name));

    const required: Array<[string, string]> = [
      ["widget_layout", "TEXT"],
      ["project_integrations", "TEXT"],
      ["integration_connections", "TEXT"],
      ["project_context_map", "TEXT"],
      ["llm_config", "TEXT"],
      ["debug_config", "TEXT"],
      ["routing_config", "TEXT"],
      ["workflows", "TEXT"],
      ["feature_preferences", "TEXT"],
      ["user_plan", "TEXT"],
      ["license_key", "TEXT"],
    ];

    for (const [col, type] of required) {
      if (!existing.has(col)) {
        await db.run(sql.raw(`ALTER TABLE user_settings ADD COLUMN ${col} ${type}`));
      }
    }

    this.columnsReady = true;
  }

  async getProjectOrder(): Promise<string[]> {
    await this.ensureColumns();
    const db = getDb();
    const row = await db.select().from(userSettings).where(eq(userSettings.id, SETTINGS_ID)).get();

    if (!row?.projectOrder) return [];
    return JSON.parse(row.projectOrder) as string[];
  }

  async setProjectOrder(order: string[]): Promise<void> {
    await this.ensureColumns();
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);

    await db
      .insert(userSettings)
      .values({
        id: SETTINGS_ID,
        projectOrder: JSON.stringify(order),
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: userSettings.id,
        set: {
          projectOrder: JSON.stringify(order),
          updatedAt: now,
        },
      });
  }

  async getWidgetLayout(): Promise<WidgetLayoutConfig | null> {
    await this.ensureColumns();
    const db = getDb();
    const row = await db.select().from(userSettings).where(eq(userSettings.id, SETTINGS_ID)).get();

    if (!row?.widgetLayout) return null;
    return JSON.parse(row.widgetLayout) as WidgetLayoutConfig;
  }

  async setWidgetLayout(config: WidgetLayoutConfig): Promise<void> {
    await this.ensureColumns();
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);

    await db
      .insert(userSettings)
      .values({
        id: SETTINGS_ID,
        widgetLayout: JSON.stringify(config),
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: userSettings.id,
        set: {
          widgetLayout: JSON.stringify(config),
          updatedAt: now,
        },
      });
  }

  async getProjectIntegrations(): Promise<ProjectIntegrationsConfig> {
    await this.ensureColumns();
    const db = getDb();
    const row = await db.select().from(userSettings).where(eq(userSettings.id, SETTINGS_ID)).get();

    if (!row?.projectIntegrations) return {};
    return JSON.parse(row.projectIntegrations) as ProjectIntegrationsConfig;
  }

  async setProjectIntegrations(config: ProjectIntegrationsConfig): Promise<void> {
    await this.ensureColumns();
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);

    await db
      .insert(userSettings)
      .values({
        id: SETTINGS_ID,
        projectIntegrations: JSON.stringify(config),
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: userSettings.id,
        set: {
          projectIntegrations: JSON.stringify(config),
          updatedAt: now,
        },
      });
  }

  async getIntegrationConnections(): Promise<IntegrationConnectionsConfig> {
    await this.ensureColumns();
    const db = getDb();
    const row = await db.select().from(userSettings).where(eq(userSettings.id, SETTINGS_ID)).get();

    if (!row?.integrationConnections) return [];
    return JSON.parse(row.integrationConnections) as IntegrationConnectionsConfig;
  }

  async setIntegrationConnections(config: IntegrationConnectionsConfig): Promise<void> {
    await this.ensureColumns();
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);

    await db
      .insert(userSettings)
      .values({
        id: SETTINGS_ID,
        integrationConnections: JSON.stringify(config),
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: userSettings.id,
        set: {
          integrationConnections: JSON.stringify(config),
          updatedAt: now,
        },
      });
  }

  async getProjectContextMap(): Promise<ProjectContextMap> {
    await this.ensureColumns();
    const db = getDb();
    const row = await db.select().from(userSettings).where(eq(userSettings.id, SETTINGS_ID)).get();

    if (!row?.projectContextMap) return {};
    return JSON.parse(row.projectContextMap) as ProjectContextMap;
  }

  async setProjectContextMap(ctx: ProjectContextMap): Promise<void> {
    await this.ensureColumns();
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);

    await db
      .insert(userSettings)
      .values({
        id: SETTINGS_ID,
        projectContextMap: JSON.stringify(ctx),
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: userSettings.id,
        set: {
          projectContextMap: JSON.stringify(ctx),
          updatedAt: now,
        },
      });
  }

  async getLlmConfig(): Promise<LlmConfig> {
    await this.ensureColumns();
    const db = getDb();
    const row = await db.select().from(userSettings).where(eq(userSettings.id, SETTINGS_ID)).get();

    if (!row?.llmConfig) return {};
    return JSON.parse(row.llmConfig) as LlmConfig;
  }

  async setLlmConfig(config: LlmConfig): Promise<void> {
    await this.ensureColumns();
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);

    await db
      .insert(userSettings)
      .values({
        id: SETTINGS_ID,
        llmConfig: JSON.stringify(config),
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: userSettings.id,
        set: {
          llmConfig: JSON.stringify(config),
          updatedAt: now,
        },
      });
  }

  async getDebugConfig(): Promise<DebugConfig> {
    await this.ensureColumns();
    const db = getDb();
    const row = await db.select().from(userSettings).where(eq(userSettings.id, SETTINGS_ID)).get();

    if (!row?.debugConfig) return {};
    return JSON.parse(row.debugConfig) as DebugConfig;
  }

  async setDebugConfig(config: DebugConfig): Promise<void> {
    await this.ensureColumns();
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);

    await db
      .insert(userSettings)
      .values({
        id: SETTINGS_ID,
        debugConfig: JSON.stringify(config),
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: userSettings.id,
        set: {
          debugConfig: JSON.stringify(config),
          updatedAt: now,
        },
      });
  }

  async getRoutingConfig(): Promise<RoutingConfig> {
    await this.ensureColumns();
    const db = getDb();
    const row = await db.select().from(userSettings).where(eq(userSettings.id, SETTINGS_ID)).get();

    if (!row?.routingConfig) return { rules: [] };
    return JSON.parse(row.routingConfig) as RoutingConfig;
  }

  async setRoutingConfig(config: RoutingConfig): Promise<void> {
    await this.ensureColumns();
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);

    await db
      .insert(userSettings)
      .values({
        id: SETTINGS_ID,
        routingConfig: JSON.stringify(config),
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: userSettings.id,
        set: {
          routingConfig: JSON.stringify(config),
          updatedAt: now,
        },
      });
  }

  async getWorkflows(): Promise<Record<string, unknown>> {
    await this.ensureColumns();
    const db = getDb();
    const row = await db.select().from(userSettings).where(eq(userSettings.id, SETTINGS_ID)).get();

    if (!row?.workflows) return {};
    return JSON.parse(row.workflows) as Record<string, unknown>;
  }

  async setWorkflows(workflows: Record<string, unknown>): Promise<void> {
    await this.ensureColumns();
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);

    await db
      .insert(userSettings)
      .values({
        id: SETTINGS_ID,
        workflows: JSON.stringify(workflows),
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: userSettings.id,
        set: {
          workflows: JSON.stringify(workflows),
          updatedAt: now,
        },
      });
  }

  async getFeaturePreferences(): Promise<FeaturePreferencesConfig> {
    await this.ensureColumns();
    const db = getDb();
    const row = await db.select().from(userSettings).where(eq(userSettings.id, SETTINGS_ID)).get();

    if (!row?.featurePreferences) return {};
    return JSON.parse(row.featurePreferences) as FeaturePreferencesConfig;
  }

  async setFeaturePreferences(prefs: FeaturePreferencesConfig): Promise<void> {
    await this.ensureColumns();
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);

    await db
      .insert(userSettings)
      .values({
        id: SETTINGS_ID,
        featurePreferences: JSON.stringify(prefs),
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: userSettings.id,
        set: {
          featurePreferences: JSON.stringify(prefs),
          updatedAt: now,
        },
      });
  }

  async getUserPlan(): Promise<string | null> {
    await this.ensureColumns();
    const db = getDb();
    const row = await db.select().from(userSettings).where(eq(userSettings.id, SETTINGS_ID)).get();
    return row?.userPlan ?? null;
  }

  async setUserPlan(plan: string): Promise<void> {
    await this.ensureColumns();
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);

    await db
      .insert(userSettings)
      .values({ id: SETTINGS_ID, userPlan: plan, updatedAt: now })
      .onConflictDoUpdate({
        target: userSettings.id,
        set: { userPlan: plan, updatedAt: now },
      });
  }

  async getLicenseKey(): Promise<string | null> {
    await this.ensureColumns();
    const db = getDb();
    const row = await db.select().from(userSettings).where(eq(userSettings.id, SETTINGS_ID)).get();
    return row?.licenseKey ?? null;
  }

  async setLicenseKey(key: string): Promise<void> {
    await this.ensureColumns();
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);

    await db
      .insert(userSettings)
      .values({ id: SETTINGS_ID, licenseKey: key, updatedAt: now })
      .onConflictDoUpdate({
        target: userSettings.id,
        set: { licenseKey: key, updatedAt: now },
      });
  }
}
