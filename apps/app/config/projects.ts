import type { Project } from "@radarboard/types/project";

/**
 * Default project configuration for new installations.
 *
 * For development, create a `.radarboard.json` config file with your projects,
 * or configure them through the Settings UI.
 *
 * This file intentionally ships empty — user projects are stored in the database
 * and configured through the onboarding wizard or settings.
 */
export const PROJECTS: Project[] = [];
