// @generated — do not edit manually. Run `pnpm generate:extensions` to regenerate.

/**
 * Registers all first-party plugins.
 * Import this early in the app before PluginHost mounts.
 */

import { tasksDescriptor } from "@radarboard/plugin-tasks";
import { expensesDescriptor } from "@radarboard/plugin-expenses";
import { notesDescriptor } from "@radarboard/plugin-notes";
import { bookmarksDescriptor } from "@radarboard/plugin-bookmarks";
import { rssReaderDescriptor } from "@radarboard/plugin-rss-reader";
import { changelogDescriptor } from "@radarboard/plugin-changelog";
import { statusPageDescriptor } from "@radarboard/plugin-status-page";
import { webhookRelayDescriptor } from "@radarboard/plugin-webhook-relay";
import { embeddingsDescriptor } from "@radarboard/plugin-embeddings";
import { backupDescriptor } from "@radarboard/plugin-backup";
import { registerPlugin } from "@radarboard/plugin-sdk/registry";
import { tasksWidgetContribution } from "@radarboard/plugin-tasks/widget-contribution";
import { expensesWidgetContribution } from "@radarboard/plugin-expenses/widget-contribution";
import { notesWidgetContribution } from "@radarboard/plugin-notes/widget-contribution";
import { bookmarksWidgetContribution } from "@radarboard/plugin-bookmarks/widget-contribution";
import { rssWidgetContribution } from "@radarboard/plugin-rss-reader/widget-contribution";
import { changelogWidgetContribution } from "@radarboard/plugin-changelog/widget-contribution";
import { statusPageWidgetContribution } from "@radarboard/plugin-status-page/widget-contribution";
import { webhookRelayWidgetContribution } from "@radarboard/plugin-webhook-relay/widget-contribution";

registerPlugin({ ...tasksDescriptor, widgets: [tasksWidgetContribution] });
registerPlugin({ ...expensesDescriptor, widgets: [expensesWidgetContribution] });
registerPlugin({ ...notesDescriptor, widgets: [notesWidgetContribution] });
registerPlugin({ ...bookmarksDescriptor, widgets: [bookmarksWidgetContribution] });
registerPlugin({ ...rssReaderDescriptor, widgets: [rssWidgetContribution] });
registerPlugin({ ...changelogDescriptor, widgets: [changelogWidgetContribution] });
registerPlugin({ ...statusPageDescriptor, widgets: [statusPageWidgetContribution] });
registerPlugin({ ...webhookRelayDescriptor, widgets: [webhookRelayWidgetContribution] });
registerPlugin(embeddingsDescriptor);
registerPlugin(backupDescriptor);
