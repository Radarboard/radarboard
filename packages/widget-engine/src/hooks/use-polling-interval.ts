import { usePollingInterval as useSharedPollingInterval } from "@radarboard/hooks/use-polling-interval";
import type { PollingSourceId } from "@radarboard/types/polling";

export function usePollingInterval(sourceId: PollingSourceId): number {
  return useSharedPollingInterval(sourceId);
}
