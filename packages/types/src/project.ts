export type PlatformType = "ios" | "android" | "mac" | "watch" | "web_app" | "website";

/**
 * Platform integration configuration.
 *
 * Open-ended record — each integration defines its own config shape.
 * Individual integration packages export typed schemas for validation.
 *
 * Example: `{ github: { owner: "foo", repo: "bar" }, vercel: { projectId: "prj_123" } }`
 */
export type PlatformIntegrations = Record<string, Record<string, unknown>>;

export interface Platform {
  id: string;
  name: string;
  type: PlatformType;
  integrations: PlatformIntegrations;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  color: string;
  description?: string;
  platforms: Platform[];
}
