/**
 * No-code / user-defined REST integrations.
 *
 * A `UserRestIntegrationConfig` is a fully SERIALIZABLE description of a REST
 * integration (safe to store in the DB and to generate with the AI). The
 * hydrator validates it and turns it into a live `IntegrationDescriptor` via the
 * SDK factory — resolving the icon-by-key and compiling the declarative
 * path/query templates into fetch functions. No code ships; the integration is
 * registered at runtime.
 */
import { createRestIntegration, type RestAuthScheme } from "@radarboard/integration-sdk";
import type {
  CommonRouteParams,
  IntegrationAuthField,
  IntegrationCategory,
  IntegrationDescriptor,
} from "@radarboard/integration-sdk/types";
import {
  Activity,
  BarChart3,
  Bell,
  Cloud,
  Code,
  Database,
  DollarSign,
  GitBranch,
  Globe,
  Package,
  Rocket,
  Users,
  Zap,
} from "lucide-react";
import type { ComponentType } from "react";

/** Curated, tree-shakeable icon allowlist. Keys are what the AI/UI reference. */
const ICON_MAP: Record<string, ComponentType<{ className?: string }>> = {
  globe: Globe,
  activity: Activity,
  chart: BarChart3,
  bell: Bell,
  cloud: Cloud,
  code: Code,
  database: Database,
  dollar: DollarSign,
  git: GitBranch,
  package: Package,
  rocket: Rocket,
  users: Users,
  zap: Zap,
};

export const USER_INTEGRATION_ICON_KEYS = Object.keys(ICON_MAP);

const CATEGORIES: IntegrationCategory[] = [
  "revenue",
  "deployment",
  "analytics",
  "monitoring",
  "communication",
];

const ID_PATTERN = /^[a-z][a-z0-9-]*$/;

/** A serializable data source for a user REST integration. */
export interface UserRestDataSourceConfig {
  action: string;
  description: string;
  cacheTtlSeconds: number;
  /** Path (relative to baseUrl). Supports {projectSlug}/{range}/{timeZone} placeholders. */
  path: string;
  method?: "GET" | "POST";
  /** Query params; values may contain the same placeholders. */
  query?: Record<string, string>;
}

/** A serializable, DB-storable description of a REST integration. */
export interface UserRestIntegrationConfig {
  id: string;
  name: string;
  description: string;
  /** Icon key from USER_INTEGRATION_ICON_KEYS (defaults to "globe"). */
  icon?: string;
  category: IntegrationCategory;
  /** Credential grouping; defaults to id. */
  provider?: string;
  baseUrl: string;
  auth: {
    scheme?: RestAuthScheme;
    tokenField?: string;
    fields?: IntegrationAuthField[];
    testPath?: string;
    docsUrl?: string;
  };
  dataSources: UserRestDataSourceConfig[];
  apiDocsUrl?: string;
}

export type HydrateResult =
  | { ok: true; descriptor: IntegrationDescriptor }
  | { ok: false; error: string };

/** Substitute {projectSlug}/{range}/{timeZone} placeholders from the route params. */
function interpolate(template: string, params: CommonRouteParams): string {
  return template.replace(/\{(projectSlug|range|timeZone)\}/g, (_m, key: string) => {
    const value = (params as unknown as Record<string, unknown>)[key];
    return value == null ? "" : String(value);
  });
}

/**
 * Validate the base URL: only https, or http on localhost (for local dev APIs).
 * This is the egress guard for arbitrary, user-supplied endpoints.
 */
export function validateBaseUrl(
  baseUrl: string
): { ok: true; url: URL } | { ok: false; error: string } {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return { ok: false, error: `Invalid baseUrl "${baseUrl}".` };
  }
  const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol === "https:" || (url.protocol === "http:" && isLocalhost)) {
    return { ok: true, url };
  }
  return { ok: false, error: "baseUrl must use https (http is only allowed for localhost)." };
}

/** Validate + compile a serializable user config into a live IntegrationDescriptor. */
export function buildRestIntegrationFromUserConfig(
  config: UserRestIntegrationConfig
): HydrateResult {
  if (!ID_PATTERN.test(config.id)) {
    return { ok: false, error: `Invalid id "${config.id}" — use kebab-case (a-z, 0-9, -).` };
  }
  if (!config.name?.trim()) return { ok: false, error: "name is required." };
  if (!CATEGORIES.includes(config.category)) {
    return { ok: false, error: `category must be one of: ${CATEGORIES.join(", ")}.` };
  }
  const urlCheck = validateBaseUrl(config.baseUrl);
  if (!urlCheck.ok) return urlCheck;
  if (!config.dataSources?.length) {
    return { ok: false, error: "At least one data source is required." };
  }
  const actions = new Set<string>();
  for (const ds of config.dataSources) {
    if (!ds.action?.trim() || !ds.path?.trim()) {
      return { ok: false, error: "Each data source needs an action and a path." };
    }
    if (actions.has(ds.action)) {
      return { ok: false, error: `Duplicate data-source action "${ds.action}".` };
    }
    actions.add(ds.action);
  }

  const icon = ICON_MAP[config.icon ?? "globe"] ?? Globe;

  const descriptor = createRestIntegration({
    id: config.id,
    name: config.name,
    description: config.description,
    icon,
    category: config.category,
    provider: config.provider,
    baseUrl: config.baseUrl,
    apiDocsUrl: config.apiDocsUrl,
    auth: {
      scheme: config.auth.scheme,
      tokenField: config.auth.tokenField,
      fields: config.auth.fields,
      testPath: config.auth.testPath,
      docsUrl: config.auth.docsUrl,
    },
    dataSources: config.dataSources.map((ds) => ({
      action: ds.action,
      description: ds.description,
      cacheTtlSeconds: ds.cacheTtlSeconds,
      method: ds.method,
      path: (params: CommonRouteParams) => interpolate(ds.path, params),
      query: ds.query
        ? (params: CommonRouteParams) =>
            Object.fromEntries(
              Object.entries(ds.query ?? {}).map(([k, v]) => [k, interpolate(v, params)])
            )
        : undefined,
    })),
  });

  return { ok: true, descriptor };
}
