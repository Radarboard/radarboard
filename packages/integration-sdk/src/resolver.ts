import { INTEGRATION_REGISTRY } from "./registry";

/** Status of a required integration dependency (installed + configured). */
export interface DependencyStatus {
  integrationId: string;
  /** Whether the integration package is registered (loaded via manifest). */
  installed: boolean;
  /** Whether the user has saved credentials for this integration. */
  configured: boolean;
}

/**
 * Check the status of required integrations.
 *
 * "installed" is determined by checking INTEGRATION_REGISTRY (populated at boot).
 * "configured" requires an async credential check, so it defaults to false here.
 * Use `checkDependenciesWithCredentials` for the full check.
 */
export function checkDependencies(requiredIntegrations: string[]): DependencyStatus[] {
  return requiredIntegrations.map((id) => ({
    integrationId: id,
    installed: INTEGRATION_REGISTRY.has(id),
    configured: false,
  }));
}

/**
 * Return only the integrations that are NOT registered in the system.
 */
export function getMissingDependencies(requiredIntegrations: string[]): DependencyStatus[] {
  return checkDependencies(requiredIntegrations).filter((dep) => !dep.installed);
}

/**
 * Check dependencies with credential verification.
 *
 * @param requiredIntegrations - Integration IDs to check.
 * @param resolveCredential - Async function that returns credentials for an integration key, or null.
 */
export async function checkDependenciesWithCredentials(
  requiredIntegrations: string[],
  resolveCredential: (key: string) => Promise<Record<string, string> | null>
): Promise<DependencyStatus[]> {
  return Promise.all(
    requiredIntegrations.map(async (id) => {
      const installed = INTEGRATION_REGISTRY.has(id);
      let configured = false;

      if (installed) {
        const descriptor = INTEGRATION_REGISTRY.get(id);
        if (descriptor?.auth.type === "none") {
          configured = true;
        } else {
          const creds = await resolveCredential(descriptor?.auth.id ?? id);
          configured = creds !== null && Object.keys(creds).length > 0;
        }
      }

      return { integrationId: id, installed, configured };
    })
  );
}
