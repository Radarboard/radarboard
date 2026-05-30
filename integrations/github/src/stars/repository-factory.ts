import type {
  DatabaseConfig,
  GitHubStarHistoryRepository,
  PlanetscaleConfig,
  SupabaseConfig,
  TursoConfig,
} from "@radarboard/types/database";
import { PlanetscaleGitHubStarHistoryRepository } from "./repositories/planetscale-github-star-history";
import { SqliteGitHubStarHistoryRepository } from "./repositories/sqlite-github-star-history";
import { SupabaseGitHubStarHistoryRepository } from "./repositories/supabase-github-star-history";
import { TursoGitHubStarHistoryRepository } from "./repositories/turso-github-star-history";

export interface SqliteGitHubStarsDependencies {
  getDb: () => unknown;
}

export function createSqliteGitHubStarHistoryRepository(
  deps: SqliteGitHubStarsDependencies
): GitHubStarHistoryRepository {
  return new SqliteGitHubStarHistoryRepository(deps);
}

export function createSupabaseGitHubStarHistoryRepository(
  config: SupabaseConfig
): GitHubStarHistoryRepository {
  return new SupabaseGitHubStarHistoryRepository(config);
}

export function createTursoGitHubStarHistoryRepository(
  config: TursoConfig
): GitHubStarHistoryRepository {
  return new TursoGitHubStarHistoryRepository(config);
}

export function createPlanetscaleGitHubStarHistoryRepository(
  config: PlanetscaleConfig
): GitHubStarHistoryRepository {
  return new PlanetscaleGitHubStarHistoryRepository(config);
}

export function createGitHubStarHistoryRepository(
  config: DatabaseConfig,
  deps: SqliteGitHubStarsDependencies
): GitHubStarHistoryRepository {
  switch (config.provider) {
    case "supabase":
      if (!config.supabase) throw new Error("Supabase config missing");
      return createSupabaseGitHubStarHistoryRepository(config.supabase);
    case "turso":
      if (!config.turso) throw new Error("Turso config missing");
      return createTursoGitHubStarHistoryRepository(config.turso);
    case "planetscale":
      if (!config.planetscale) throw new Error("PlanetScale config missing");
      return createPlanetscaleGitHubStarHistoryRepository(config.planetscale);
    default:
      return createSqliteGitHubStarHistoryRepository(deps);
  }
}
