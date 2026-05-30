"use client";

import { useNotificationPreferences } from "@radarboard/hooks/use-notification-preferences";
import type {
  NotificationPreferenceRow,
  NotificationPreset,
} from "@radarboard/types/notifications";
import { Input } from "@radarboard/ui/input";
import { Label } from "@radarboard/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@radarboard/ui/select";
import { Switch } from "@radarboard/ui/switch";
import { NOTIFICATION_PRESET_OPTIONS } from "@/components/settings/settings-integrations/constants";
import { defaultNotificationPreference } from "@/components/settings/settings-integrations/utils";

export function IntegrationNotificationsCard({ serviceId }: { serviceId: string }) {
  const { preferences, savePreference } = useNotificationPreferences();
  const preference =
    preferences.find((item) => item.id === serviceId) ?? defaultNotificationPreference(serviceId);

  async function update(next: NotificationPreferenceRow) {
    await savePreference({ ...next, updatedAt: Math.floor(Date.now() / 1000) });
  }

  return (
    <div className="space-y-4 rounded-item border border-border bg-surface p-4">
      <div>
        <div className="font-mono text-foreground text-w-base">Notifications</div>
        <div className="text-dim text-w-sm">
          Controls how this integration contributes events to the notification pipeline.
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 font-mono text-dim text-w-sm">
        <span>Enable notifications</span>
        <Switch
          checked={preference.enabled}
          onCheckedChange={(checked) => update({ ...preference, enabled: checked })}
          aria-label={`Toggle ${serviceId} notifications`}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="notification-preset">Preset</Label>
        <Select
          value={preference.preset}
          onValueChange={(v) =>
            update({
              ...preference,
              preset: v as NotificationPreset,
            })
          }
        >
          <SelectTrigger id="notification-preset">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {NOTIFICATION_PRESET_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="digest-window">Digest window (seconds)</Label>
        <Input
          id="digest-window"
          type="number"
          min={60}
          max={3600}
          step={60}
          value={preference.digestWindow}
          onChange={(event) => {
            const nextValue = Number(event.target.value);
            if (!Number.isFinite(nextValue)) return;
            update({
              ...preference,
              digestWindow: Math.max(60, Math.min(3600, nextValue)),
            }).catch(() => {
              /* fire-and-forget */
            });
          }}
        />
      </div>

      <div className="rounded-item border border-border border-dashed bg-muted p-3 text-dim text-w-sm leading-relaxed">
        Global channels, quiet hours, custom rules, and outbound webhooks live in the Notifications
        settings page.
      </div>
    </div>
  );
}
