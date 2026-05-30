import type { NotificationEventRow, NotificationSeverity } from "@radarboard/types/notifications";

export interface NotificationEventFilter {
  source?: string;
  type?: string;
  severity?: NotificationSeverity;
  projectSlug?: string;
}

type NotificationEventListener = (event: NotificationEventRow) => void;

class NotificationEventBus {
  private listeners = new Set<{
    filter: NotificationEventFilter;
    listener: NotificationEventListener;
  }>();

  emit(event: NotificationEventRow): void {
    for (const entry of this.listeners) {
      if (!this.matches(entry.filter, event)) continue;
      entry.listener(event);
    }
  }

  emitBatch(events: NotificationEventRow[]): void {
    for (const event of events) {
      this.emit(event);
    }
  }

  on(filter: NotificationEventFilter, listener: NotificationEventListener): () => void {
    const entry = { filter, listener };
    this.listeners.add(entry);
    return () => {
      this.listeners.delete(entry);
    };
  }

  private matches(filter: NotificationEventFilter, event: NotificationEventRow): boolean {
    if (filter.source && filter.source !== event.source) return false;
    if (filter.type && filter.type !== event.type) return false;
    if (filter.severity && filter.severity !== event.severity) return false;
    if (filter.projectSlug && filter.projectSlug !== (event.projectSlug ?? undefined)) return false;
    return true;
  }
}

export const notificationEventBus = new NotificationEventBus();
