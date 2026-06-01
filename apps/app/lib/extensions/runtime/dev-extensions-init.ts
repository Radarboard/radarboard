// @generated — do not edit manually. Run `pnpm generate:extensions` to regenerate.

/**
 * Registers local dev extensions from filesystem paths.
 * Configure with explicit local opt-ins in .radarboard/dev-extensions.json.
 */

import { registerIntegration } from "@radarboard/integration-sdk/registry";
import { sentryDescriptor as devExt0Descriptor } from "../../../.radarboard/dev-extensions/sentry/src/index";

export function initializeDevExtensions(): void {
  // Dev extension: apps/app/.radarboard/dev-extensions/sentry (integration)
  registerIntegration(devExt0Descriptor);
}
