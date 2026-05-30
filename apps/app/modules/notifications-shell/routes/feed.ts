import { withLogging } from "@radarboard/logger/middleware";
import { API_ROUTES } from "@radarboard/types/api-routes";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getNotificationRepo } from "@/db/repository";
import { errorJson, parseBody, parseSearchParams } from "@/lib/api";
import {
  dismissNotification,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications";

const PostSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("mark_read"),
    id: z.string().min(1),
  }),
  z.object({
    action: z.literal("mark_dismissed"),
    id: z.string().min(1),
  }),
  z.object({
    action: z.literal("mark_all_read"),
    source: z.string().min(1).optional(),
    projectSlug: z.string().min(1).optional(),
  }),
]);
const listNotificationsQuerySchema = z.object({
  countOnly: z.string().optional(),
  limit: z.string().optional(),
  cursor: z.string().optional(),
  source: z.string().optional(),
  severity: z.string().optional(),
  projectSlug: z.string().optional(),
  status: z.string().optional(),
  includeDismissed: z.string().optional(),
});

export const handleListNotifications = withLogging(
  API_ROUTES.notifications,
  async (request: Request) => {
    const repo = getNotificationRepo();
    if (!repo) {
      return errorJson(501, "Notifications are not supported by the current database provider");
    }

    const parsed = parseSearchParams(
      new URL(request.url).searchParams,
      listNotificationsQuerySchema
    );
    if (!parsed.ok) return parsed.response;
    const countOnly = parsed.data.countOnly === "1";

    if (countOnly) {
      const unreadCount = await repo.getUnreadCount();
      return NextResponse.json({ unreadCount });
    }

    const limit = Number(parsed.data.limit ?? 50);
    const cursorParam = parsed.data.cursor;
    const source = parsed.data.source ?? undefined;
    const severityParam = parsed.data.severity;
    const projectSlug = parsed.data.projectSlug ?? undefined;
    const statusParam = parsed.data.status;
    const includeDismissed = parsed.data.includeDismissed === "1";

    const severity =
      severityParam === "critical" || severityParam === "warning" || severityParam === "info"
        ? severityParam
        : undefined;
    const status =
      statusParam === "unread" || statusParam === "read" || statusParam === "all"
        ? statusParam
        : undefined;
    const cursor = cursorParam ? Number(cursorParam) : undefined;

    const [feed, unreadCount] = await Promise.all([
      repo.getFeed({
        limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 50,
        cursor: cursor && Number.isFinite(cursor) ? cursor : undefined,
        source,
        severity,
        projectSlug,
        status,
        includeDismissed,
      }),
      repo.getUnreadCount(),
    ]);

    return NextResponse.json({
      items: feed.items,
      nextCursor: feed.nextCursor,
      unreadCount,
    });
  }
);

export const handleUpdateNotifications = withLogging(
  API_ROUTES.notifications,
  async (request: Request) => {
    const parsed = await parseBody(request, PostSchema);
    if (!parsed.ok) return parsed.response;

    switch (parsed.data.action) {
      case "mark_read":
        await markNotificationRead(parsed.data.id);
        return NextResponse.json({ success: true });
      case "mark_dismissed":
        await dismissNotification(parsed.data.id);
        return NextResponse.json({ success: true });
      case "mark_all_read":
        await markAllNotificationsRead({
          source: parsed.data.source,
          projectSlug: parsed.data.projectSlug,
        });
        return NextResponse.json({ success: true });
      default:
        return errorJson(400, "Unknown action");
    }
  }
);
