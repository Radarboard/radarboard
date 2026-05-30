/* biome-ignore-all lint/style/useNamingConvention: Route handler maps intentionally use HTTP method keys. */
import { API_ROUTES } from "@radarboard/types/api-routes";
import { registerRoutes } from "@/lib/router/registry";
import { handleEmitNotification } from "./emit";
import { handleListNotifications, handleUpdateNotifications } from "./feed";
import {
  handleGetNotificationPreferences,
  handleUpsertNotificationPreferences,
} from "./preferences";
import { handleDeleteRule, handleGetRules, handleUpsertRule } from "./rules";
import { handleSendAlert } from "./send";
import { handleDownloadSound, handleListSounds } from "./sounds";
import { handleNotificationStream } from "./stream";
import { handleDeleteWebhook, handleGetWebhooks, handleUpsertWebhook } from "./webhooks";
import { handleTestWebhook } from "./webhooks-test";

registerRoutes([
  {
    path: API_ROUTES.notifications,
    handlers: { GET: handleListNotifications, POST: handleUpdateNotifications },
  },
  {
    path: API_ROUTES.notificationPreferences,
    handlers: {
      GET: handleGetNotificationPreferences,
      POST: handleUpsertNotificationPreferences,
    },
  },
  {
    path: API_ROUTES.notificationEmit,
    handlers: { POST: handleEmitNotification },
  },
  {
    path: API_ROUTES.notificationRules,
    handlers: {
      GET: handleGetRules,
      POST: handleUpsertRule,
      DELETE: handleDeleteRule,
    },
  },
  {
    path: API_ROUTES.alertsSend,
    handlers: { POST: handleSendAlert },
  },
  {
    path: API_ROUTES.notificationSounds,
    handlers: { GET: handleListSounds, POST: handleDownloadSound },
  },
  {
    path: API_ROUTES.notificationsStream,
    handlers: { GET: handleNotificationStream },
  },
  {
    path: API_ROUTES.notificationWebhooks,
    handlers: {
      GET: handleGetWebhooks,
      POST: handleUpsertWebhook,
      DELETE: handleDeleteWebhook,
    },
  },
  {
    path: API_ROUTES.notificationWebhooksTest,
    handlers: { POST: handleTestWebhook },
  },
]);
