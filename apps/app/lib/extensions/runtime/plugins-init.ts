// @generated — do not edit manually. Run `pnpm generate:extensions` to regenerate.

/**
 * Registers all first-party plugins.
 * Import this early in the app before PluginHost mounts.
 */

import { backupDescriptor } from "@radarboard/plugin-backup";
import { bookmarksDescriptor } from "@radarboard/plugin-bookmarks";
import { bookmarksWidgetContribution } from "@radarboard/plugin-bookmarks/widget-contribution";
import { changelogDescriptor } from "@radarboard/plugin-changelog";
import { changelogWidgetContribution } from "@radarboard/plugin-changelog/widget-contribution";
import { embeddingsDescriptor } from "@radarboard/plugin-embeddings";
import { expensesDescriptor } from "@radarboard/plugin-expenses";
import { expensesWidgetContribution } from "@radarboard/plugin-expenses/widget-contribution";
import { notesDescriptor } from "@radarboard/plugin-notes";
import { notesWidgetContribution } from "@radarboard/plugin-notes/widget-contribution";
import { rssReaderDescriptor } from "@radarboard/plugin-rss-reader";
import { rssWidgetContribution } from "@radarboard/plugin-rss-reader/widget-contribution";
import { registerPlugin } from "@radarboard/plugin-sdk/registry";
import { statusPageDescriptor } from "@radarboard/plugin-status-page";
import { statusPageWidgetContribution } from "@radarboard/plugin-status-page/widget-contribution";
import { tasksDescriptor } from "@radarboard/plugin-tasks";
import { tasksWidgetContribution } from "@radarboard/plugin-tasks/widget-contribution";
import { webhookRelayDescriptor } from "@radarboard/plugin-webhook-relay";
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
