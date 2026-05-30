import type { NotificationStreamMessage } from "@radarboard/types/notifications";

type NotificationStreamListener = (message: NotificationStreamMessage) => void;

class NotificationStreamHub {
  private listeners = new Set<NotificationStreamListener>();

  publish(message: NotificationStreamMessage): void {
    for (const listener of this.listeners) {
      listener(message);
    }
  }

  subscribe(listener: NotificationStreamListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const notificationStreamHub = new NotificationStreamHub();
