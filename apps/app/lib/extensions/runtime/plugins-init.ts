// @generated — do not edit manually. Run `pnpm generate:extensions` to regenerate.

/**
 * Registers all first-party plugins.
 * Import this early in the app before PluginHost mounts.
 */

import { backupDescriptor } from "@radarboard/plugin-backup";
import { bookmarksDescriptor } from "@radarboard/plugin-bookmarks";
import { bookmarksWidgetContribution } from "@radarboard/plugin-bookmarks/widget-contribution";
import { embeddingsDescriptor } from "@radarboard/plugin-embeddings";
import { notesDescriptor } from "@radarboard/plugin-notes";
import { notesWidgetContribution } from "@radarboard/plugin-notes/widget-contribution";
import { registerPlugin } from "@radarboard/plugin-sdk/registry";
import { tasksDescriptor } from "@radarboard/plugin-tasks";
import { tasksWidgetContribution } from "@radarboard/plugin-tasks/widget-contribution";

registerPlugin({ ...tasksDescriptor, widgets: [tasksWidgetContribution] });
registerPlugin({ ...notesDescriptor, widgets: [notesWidgetContribution] });
registerPlugin({ ...bookmarksDescriptor, widgets: [bookmarksWidgetContribution] });
registerPlugin(embeddingsDescriptor);
registerPlugin(backupDescriptor);
