export async function syncRssFeedsRoute(
  syncRssFeeds: (options?: { emitNotifications?: boolean }) => Promise<Record<string, unknown>>,
  input: { emitNotifications?: boolean }
) {
  return {
    ok: true,
    ...(await syncRssFeeds({
      emitNotifications: input.emitNotifications ?? false,
    })),
  };
}
