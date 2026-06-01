"use client";

import {
  DEFAULT_SOUNDS,
  playSound,
  useAvailableSounds,
} from "@radarboard/hooks/use-audio-notifications";
import { useCredentials } from "@radarboard/hooks/use-credentials";
import { useDesktopNotifications } from "@radarboard/hooks/use-desktop-notifications";
import { useNotificationPreferences } from "@radarboard/hooks/use-notification-preferences";
import { useNotificationRules } from "@radarboard/hooks/use-notification-rules";
import { useWebhookEndpoints } from "@radarboard/hooks/use-webhook-endpoints";
import { INTEGRATION_REGISTRY } from "@radarboard/integration-sdk/registry";
import type {
  NotificationChannel,
  NotificationPreferenceRow,
  NotificationPreset,
  NotificationRuleCondition,
  NotificationRuleConditionOperator,
  NotificationRuleConditionValueType,
  NotificationRuleRow,
  NotificationSeverity,
  WebhookEndpointRow,
} from "@radarboard/types/notifications";
import { VIEW_STATE_QUERY_KEYS } from "@radarboard/types/view-state";
import { Button } from "@radarboard/ui/button";
import { EmptyState } from "@radarboard/ui/empty-state";
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
import { cn } from "@radarboard/utils/cn";
import { Copy, DownloadCloud, Loader2, Plus, Trash2 } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RemoteServiceIcon } from "@/components/shared/remote-service-icon";
import { generateSecret } from "@/lib/generate-secret";
import { getServiceFaviconUrl } from "@/lib/service-favicons";
import { PollingSourceControls } from "../polling-controls";
import { SettingsSectionNav } from "../section-nav";
import { CATEGORY_ORDER, INTEGRATION_CATEGORY_LABELS } from "../settings-integrations/constants";
import { SettingsGrid, SettingsPageLayout } from "../settings-page-layout";
import type { SettingsNotificationsTab as Tab } from "../settings-storage";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function sourceLabel(id: string): string {
  if (id === "global") return "Global defaults";
  if (id === "alerts") return "Alerts";
  return id
    .split(/[-_]/g)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function defaultPreference(id: string): NotificationPreferenceRow {
  return {
    id,
    enabled: true,
    preset: id === "global" || id === "alerts" ? "all" : "critical_only",
    digestWindow: 300,
    channels: ["in_app"],
    quietHours: null,
    updatedAt: nowSeconds(),
  };
}

// ---------------------------------------------------------------------------
// Tab navigation
// ---------------------------------------------------------------------------

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "sources", label: "Sources" },
  { id: "quiet-hours", label: "Quiet Hours" },
  { id: "channels", label: "Channels" },
  { id: "rules", label: "Rules" },
  { id: "webhooks", label: "Webhooks" },
];
const NOTIFICATIONS_TAB_IDS = ["sources", "quiet-hours", "channels", "rules", "webhooks"] as const;
const DEFAULT_NOTIFICATIONS_TAB: Tab = "sources";

// ---------------------------------------------------------------------------
// Sources tab — per-integration preference cards
// ---------------------------------------------------------------------------

const PRESET_OPTIONS: Array<{ value: NotificationPreset; label: string }> = [
  { value: "all", label: "Everything" },
  { value: "critical_only", label: "Critical only" },
  { value: "deploys_and_errors", label: "Deploys & errors" },
  { value: "custom", label: "Custom" },
];

function PreferenceCard({
  preference,
  saving,
  onChange,
}: {
  preference: NotificationPreferenceRow;
  saving: boolean;
  onChange: (next: NotificationPreferenceRow) => void;
}) {
  const faviconUrl =
    preference.id === "global" || preference.id === "alerts"
      ? null
      : getServiceFaviconUrl(preference.id, 32);

  return (
    <div className="min-w-0 space-y-3 rounded-item border border-border bg-surface p-4">
      <div className="flex min-w-0 items-start gap-3">
        <div className="shrink-0">
          {faviconUrl ? (
            <RemoteServiceIcon src={faviconUrl} alt="" size={22} className="rounded-item" />
          ) : (
            <div className="flex h-[22px] w-[22px] items-center justify-center rounded-item bg-secondary font-mono text-dim text-w-sm">
              {preference.id === "global" ? "*" : "!"}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="min-w-0">
            <div className="truncate font-mono text-foreground-secondary text-w-base">
              {sourceLabel(preference.id)}
            </div>
            <div className="truncate text-dim text-w-sm">
              {preference.id === "global"
                ? "Fallback for all sources"
                : "Overrides global for this source"}
            </div>
            {saving ? <div className="mt-1 font-mono text-accent text-w-sm">Saving…</div> : null}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 font-mono text-dim text-w-sm">
        <span>Enabled</span>
        <Switch
          checked={preference.enabled}
          onCheckedChange={(checked) =>
            onChange({ ...preference, enabled: checked, updatedAt: nowSeconds() })
          }
          aria-label={`Toggle ${sourceLabel(preference.id)} notifications`}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor={`preset-${preference.id}`}>Preset</Label>
        <Select
          value={preference.preset}
          onValueChange={(v) =>
            onChange({
              ...preference,
              preset: v as NotificationPreset,
              updatedAt: nowSeconds(),
            })
          }
        >
          <SelectTrigger id={`preset-${preference.id}`} className="h-9 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRESET_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor={`digest-${preference.id}`}>Digest window (s)</Label>
        <Input
          id={`digest-${preference.id}`}
          type="number"
          min={60}
          max={3600}
          step={60}
          value={preference.digestWindow}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (!Number.isFinite(v)) return;
            onChange({
              ...preference,
              digestWindow: Math.max(60, Math.min(3600, v)),
              updatedAt: nowSeconds(),
            });
          }}
          className="h-9 w-full"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Channels tab — desktop permission toggle
// ---------------------------------------------------------------------------

function GlobalChannelsCard({
  globalPreference,
  onSave,
}: {
  globalPreference: NotificationPreferenceRow;
  onSave: (pref: NotificationPreferenceRow) => Promise<void>;
}) {
  function hasChannel(channel: NotificationChannel): boolean {
    return globalPreference.channels.includes(channel);
  }

  async function toggleChannel(channel: NotificationChannel, enabled: boolean) {
    const nextChannels = enabled
      ? [...new Set([...globalPreference.channels, channel])]
      : globalPreference.channels.filter((current) => current !== channel);

    await onSave({
      ...globalPreference,
      channels: nextChannels,
      updatedAt: nowSeconds(),
    });
  }

  return (
    <div className="min-w-0 space-y-4 rounded-item border border-border bg-surface p-4">
      <div>
        <div className="font-mono text-foreground-secondary text-w-base">Global Channels</div>
        <div className="text-dim text-w-sm">
          Default channels used when a source preset allows an event.
        </div>
      </div>

      {(["in_app", "webhook", "mcp"] as NotificationChannel[]).map((channel) => (
        <div
          key={channel}
          className="flex items-center justify-between gap-3 font-mono text-dim text-w-sm"
        >
          <span>{channel}</span>
          <Switch
            checked={hasChannel(channel)}
            onCheckedChange={(checked) => toggleChannel(channel, checked)}
            aria-label={`Toggle ${channel} channel`}
          />
        </div>
      ))}

      <div className="space-y-1 rounded-item border border-border border-dashed bg-secondary/30 p-3">
        <div className="font-mono text-foreground-secondary text-w-sm">Email</div>
        <div className="text-dim text-w-sm">
          Resend-backed email digests are documented and queued for a later pass.
        </div>
      </div>
    </div>
  );
}

function DesktopPermissionCard({
  globalPreference,
  onSave,
}: {
  globalPreference: NotificationPreferenceRow;
  onSave: (pref: NotificationPreferenceRow) => Promise<void>;
}) {
  const { permission, requestPermission } = useDesktopNotifications(false);
  const desktopEnabled = globalPreference.channels.includes("desktop");

  async function toggleDesktop(enabled: boolean) {
    let next: NotificationChannel[];
    if (enabled) {
      const granted = await requestPermission();
      if (granted !== "granted") return;
      next = [...new Set([...globalPreference.channels, "desktop" as NotificationChannel])];
    } else {
      next = globalPreference.channels.filter((c) => c !== "desktop");
    }
    await onSave({ ...globalPreference, channels: next, updatedAt: nowSeconds() });
  }

  return (
    <div className="min-w-0 space-y-3 rounded-item border border-border bg-surface p-4">
      <div className="font-mono text-foreground-secondary text-w-base">Desktop</div>
      <div className="text-dim text-w-sm">
        Show OS notifications when Radarboard is in the background.
      </div>

      {permission === "unsupported" && (
        <div className="text-dim text-w-sm">Not supported by this browser.</div>
      )}
      {permission === "denied" && (
        <div className="text-destructive text-w-sm">
          Denied. Reset permission in browser settings.
        </div>
      )}
      {permission !== "unsupported" && permission !== "denied" && (
        <div className="flex items-center justify-between gap-3 font-mono text-dim text-w-sm">
          <span>{desktopEnabled ? "Enabled" : "Disabled"}</span>
          <Switch
            checked={desktopEnabled}
            onCheckedChange={(checked) => toggleDesktop(checked)}
            aria-label="Toggle desktop notifications"
          />
        </div>
      )}

      <div
        className={cn(
          "rounded-item px-2 py-1 font-mono text-w-sm",
          permission === "granted" ? "bg-success/10 text-success" : "bg-secondary text-dim"
        )}
      >
        Permission: {permission}
      </div>
    </div>
  );
}

function ImportSoundField({ onImport }: { onImport: (url: string) => Promise<void> }) {
  const [url, setUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleImport() {
    if (!url || !url.startsWith("https://www.soundcn.xyz/r/")) {
      setError("Please enter a valid SoundCN registry URL (https://www.soundcn.xyz/r/...)");
      return;
    }

    setImporting(true);
    setError(null);
    try {
      await onImport(url);
      setUrl("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to import sound");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-2 border-border border-t pt-4">
      <div className="font-mono text-dim text-w-xs uppercase tracking-wider">
        Import from SoundCN
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="https://www.soundcn.xyz/r/magic-chime.json"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="h-8 font-mono text-w-sm"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={handleImport}
          disabled={importing || !url}
          className="h-8 shrink-0"
        >
          {importing ? (
            <Loader2 className="icon-xs animate-spin" />
          ) : (
            <DownloadCloud className="icon-xs" />
          )}
        </Button>
      </div>
      {error ? <div className="text-destructive text-w-xs">{error}</div> : null}
    </div>
  );
}

function SoundChannelCard({
  globalPreference,
  onSave,
}: {
  globalPreference: NotificationPreferenceRow;
  onSave: (pref: NotificationPreferenceRow) => Promise<void>;
}) {
  const soundEnabled = globalPreference.channels.includes("sound");
  const { sounds, downloadSound } = useAvailableSounds();

  async function toggleSound(enabled: boolean) {
    const nextChannels = enabled
      ? [...new Set([...globalPreference.channels, "sound" as NotificationChannel])]
      : globalPreference.channels.filter((c) => c !== "sound");

    await onSave({
      ...globalPreference,
      channels: nextChannels,
      updatedAt: nowSeconds(),
    });
  }

  async function updateSound(severity: NotificationSeverity, url: string) {
    const nextSounds = {
      ...(globalPreference.sounds || {}),
      [severity]: url === "none" ? "" : url,
    } as Record<NotificationSeverity, string>;

    await onSave({
      ...globalPreference,
      sounds: nextSounds,
      updatedAt: nowSeconds(),
    });

    if (url !== "none" && url !== "") {
      playSound(url);
    }
  }

  return (
    <div className="min-w-0 space-y-4 rounded-item border border-border bg-surface p-4">
      <div>
        <div className="font-mono text-foreground-secondary text-w-base">Audio</div>
        <div className="text-dim text-w-sm">Play a sound when a new notification is delivered.</div>
      </div>

      <div className="flex items-center justify-between gap-3 font-mono text-dim text-w-sm">
        <span>{soundEnabled ? "Enabled" : "Disabled"}</span>
        <Switch
          checked={soundEnabled}
          onCheckedChange={(checked) => toggleSound(checked)}
          aria-label="Toggle notification sounds"
        />
      </div>

      <div
        className={cn(
          "space-y-3 transition-opacity",
          !soundEnabled && "pointer-events-none opacity-40"
        )}
      >
        {(["critical", "warning", "info", "success"] as NotificationSeverity[]).map((severity) => {
          const currentUrl = globalPreference.sounds?.[severity] || DEFAULT_SOUNDS[severity];

          return (
            <div key={severity} className="space-y-1">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor={`sound-${severity}`}
                  className="font-mono text-dim text-w-xs uppercase tracking-wider"
                >
                  {severity}
                </Label>
              </div>
              <div className="flex gap-2">
                <Select
                  value={currentUrl || "none"}
                  onValueChange={(url) =>
                    updateSound(severity, url).catch(() => {
                      /* fire-and-forget */
                    })
                  }
                >
                  <SelectTrigger
                    id={`sound-${severity}`}
                    className="h-8 flex-1 font-mono text-w-sm"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {sounds.map((sound) => (
                      <SelectItem key={sound.id} value={sound.url}>
                        {sound.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    playSound(currentUrl);
                  }}
                  disabled={!currentUrl || currentUrl === "none"}
                  className="h-8 w-8 p-0"
                  aria-label={`Test ${severity} sound`}
                >
                  ▶
                </Button>
              </div>
            </div>
          );
        })}

        <ImportSoundField
          onImport={async (url) => {
            await downloadSound(url);
          }}
        />
      </div>

      <div className="text-dim text-w-xs uppercase tracking-wider">Source: soundcn.xyz</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quiet hours tab
// ---------------------------------------------------------------------------

const TIMEZONES = Intl.supportedValuesOf
  ? Intl.supportedValuesOf("timeZone")
  : [
      "UTC",
      "America/New_York",
      "America/Los_Angeles",
      "Europe/London",
      "Europe/Paris",
      "Asia/Tokyo",
    ];

function QuietHoursSection({
  globalPreference,
  onSave,
}: {
  globalPreference: NotificationPreferenceRow;
  onSave: (pref: NotificationPreferenceRow) => Promise<void>;
}) {
  const qh = globalPreference.quietHours;
  const [draft, setDraft] = useState(() => ({
    enabled: Boolean(qh),
    start: qh?.start ?? "22:00",
    end: qh?.end ?? "08:00",
    timezone: qh?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
  }));
  const [saving, setSaving] = useState(false);

  async function save(nextEnabled: boolean, nextDraft = draft) {
    setSaving(true);
    try {
      await onSave({
        ...globalPreference,
        quietHours: nextEnabled
          ? {
              start: nextDraft.start,
              end: nextDraft.end,
              timezone: nextDraft.timezone,
            }
          : null,
        updatedAt: nowSeconds(),
      });
      setDraft({ ...nextDraft, enabled: nextEnabled });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-lg space-y-4">
      <div className="space-y-5 rounded-item border border-border bg-surface p-5">
        <div>
          <div className="mb-1 font-mono text-foreground-secondary text-w-base">Quiet Hours</div>
          <div className="text-dim text-w-sm">
            Suppress warning and info notifications during these hours. Critical alerts always
            bypass quiet hours.
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 font-mono text-dim text-w-sm">
          <span>Enable quiet hours</span>
          <Switch
            checked={draft.enabled}
            onCheckedChange={(checked) =>
              save(checked).catch(() => {
                /* fire-and-forget */
              })
            }
            aria-label="Toggle quiet hours"
          />
        </div>

        <div
          className={cn(
            "space-y-4 transition-opacity",
            !draft.enabled && "pointer-events-none opacity-40"
          )}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="qh-start">Start</Label>
              <Input
                id="qh-start"
                type="time"
                value={draft.start}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, start: event.target.value }))
                }
                onBlur={() => {
                  if (draft.enabled)
                    save(true).catch(() => {
                      /* fire-and-forget */
                    });
                }}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="qh-end">End</Label>
              <Input
                id="qh-end"
                type="time"
                value={draft.end}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, end: event.target.value }))
                }
                onBlur={() => {
                  if (draft.enabled)
                    save(true).catch(() => {
                      /* fire-and-forget */
                    });
                }}
                className="h-9"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="qh-timezone">Timezone</Label>
            <Select
              value={draft.timezone}
              onValueChange={(v) => {
                setDraft((current) => ({ ...current, timezone: v }));
                if (draft.enabled)
                  save(true).catch(() => {
                    /* fire-and-forget */
                  });
              }}
            >
              <SelectTrigger id="qh-timezone" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {Boolean(saving) && <div className="font-mono text-accent text-w-sm">Saving…</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rules tab — custom threshold rule list + form
// ---------------------------------------------------------------------------

const SEVERITY_OPTIONS: Array<{ value: NotificationSeverity; label: string }> = [
  { value: "critical", label: "Critical" },
  { value: "warning", label: "Warning" },
  { value: "info", label: "Info" },
  { value: "success", label: "Success" },
];

const CHANNEL_OPTIONS: NotificationChannel[] = [
  "in_app",
  "email",
  "desktop",
  "webhook",
  "mcp",
  "sound",
];

const VALUE_TYPE_OPTIONS: Array<{
  value: NotificationRuleConditionValueType;
  label: string;
}> = [
  { value: "string", label: "Text" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
];

const OPERATOR_OPTIONS: Array<{
  value: NotificationRuleConditionOperator;
  label: string;
}> = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Not equal" },
  { value: "contains", label: "Contains" },
  { value: "greater_than", label: ">" },
  { value: "greater_than_or_equal", label: ">=" },
  { value: "less_than", label: "<" },
  { value: "less_than_or_equal", label: "<=" },
];

const RULE_TEMPLATES: Array<{
  id: string;
  label: string;
  build: () => Partial<NotificationRuleRow>;
}> = [
  {
    id: "critical-events",
    label: "Any critical event",
    build: () => ({
      name: "Any critical event",
      severity: "critical",
      channels: ["in_app", "desktop"],
      condition: null,
    }),
  },
  {
    id: "failed-deploys",
    label: "Failed deploys",
    build: () => ({
      name: "Failed deploys",
      eventType: "deploy.failed",
      severity: "warning",
      channels: ["in_app", "webhook"],
      condition: null,
    }),
  },
  {
    id: "sentry-spike",
    label: "Sentry spikes over 50",
    build: () => ({
      name: "Sentry spikes over 50",
      source: "sentry",
      eventType: "error.spike",
      channels: ["in_app", "desktop", "webhook"],
      condition: {
        scope: "metadata",
        field: "currentCount",
        operator: "greater_than",
        valueType: "number",
        value: 50,
      },
    }),
  },
  {
    id: "downtime",
    label: "Downtime alerts",
    build: () => ({
      name: "Downtime alerts",
      source: "betterstack",
      eventType: "monitor.down",
      severity: "critical",
      channels: ["in_app", "desktop", "webhook"],
      condition: null,
    }),
  },
];

function parseConditionValue(
  valueType: NotificationRuleConditionValueType,
  raw: string
): string | number | boolean {
  if (valueType === "number") {
    return Number(raw);
  }
  if (valueType === "boolean") {
    return raw === "true";
  }
  return raw;
}

function stringifyConditionValue(condition: NotificationRuleCondition | null): string {
  if (!condition) return "";
  return String(condition.value);
}

function summarizeCondition(condition: NotificationRuleCondition | null): string {
  if (!condition) return "No condition";
  const scope = condition.scope === "metadata" ? `metadata.${condition.field}` : condition.field;
  const operator =
    OPERATOR_OPTIONS.find((item) => item.value === condition.operator)?.label ?? condition.operator;
  return `${scope} ${operator} ${String(condition.value)}`;
}

interface RuleDraft {
  name: string;
  source: string;
  eventType: string;
  severity: NotificationSeverity | "";
  channels: NotificationChannel[];
  conditionEnabled: boolean;
  conditionScope: "event" | "metadata";
  conditionField: string;
  conditionOperator: NotificationRuleConditionOperator;
  conditionValueType: NotificationRuleConditionValueType;
  conditionValue: string;
}

function buildRuleDraft(initial?: Partial<NotificationRuleRow>): RuleDraft {
  return {
    name: initial?.name ?? "",
    source: initial?.source ?? "",
    eventType: initial?.eventType ?? "",
    severity: (initial?.severity ?? "") as NotificationSeverity | "",
    channels: initial?.channels ?? ["in_app"],
    conditionEnabled: Boolean(initial?.condition),
    conditionScope: initial?.condition?.scope ?? "metadata",
    conditionField: initial?.condition?.field ?? "currentCount",
    conditionOperator: initial?.condition?.operator ?? "greater_than",
    conditionValueType: initial?.condition?.valueType ?? "number",
    conditionValue: stringifyConditionValue(initial?.condition ?? null),
  };
}

function buildRuleCondition(draft: RuleDraft): NotificationRuleCondition | null {
  if (!draft.conditionEnabled || !draft.conditionField.trim()) return null;
  return {
    scope: draft.conditionScope,
    field: draft.conditionField.trim(),
    operator: draft.conditionOperator,
    valueType: draft.conditionValueType,
    value: parseConditionValue(draft.conditionValueType, draft.conditionValue),
  };
}

function RuleTemplatePicker({
  onApply,
}: {
  onApply: (next: Partial<NotificationRuleRow>) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="font-mono text-dim text-w-sm uppercase tracking-wider">Templates</div>
      <div className="flex flex-wrap gap-2">
        {RULE_TEMPLATES.map((template) => (
          <Button
            key={template.id}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onApply(template.build())}
            className="uppercase-none h-auto px-2.5 py-1.5 font-mono text-dim text-w-sm hover:text-foreground-secondary"
          >
            {template.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function RuleConditionBuilder({
  draft,
  onChange,
}: {
  draft: RuleDraft;
  onChange: (next: RuleDraft) => void;
}) {
  return (
    <div className="space-y-4 rounded-item border border-border bg-background/50 p-4">
      <div className="flex items-center justify-between gap-3 font-mono text-dim text-w-sm">
        <span>Enable structured condition</span>
        <Switch
          checked={draft.conditionEnabled}
          onCheckedChange={(checked) => onChange({ ...draft, conditionEnabled: checked })}
          aria-label="Toggle structured condition"
        />
      </div>

      <div
        className={cn(
          "grid grid-cols-2 gap-3",
          !draft.conditionEnabled && "pointer-events-none opacity-40"
        )}
      >
        <div className="space-y-1">
          <Label htmlFor="cond-scope">Scope</Label>
          <Select
            value={draft.conditionScope}
            onValueChange={(v) => onChange({ ...draft, conditionScope: v as "event" | "metadata" })}
          >
            <SelectTrigger id="cond-scope" className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="metadata">Metadata</SelectItem>
              <SelectItem value="event">Event field</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="cond-field">Field</Label>
          <Input
            id="cond-field"
            type="text"
            value={draft.conditionField}
            onChange={(event) => onChange({ ...draft, conditionField: event.target.value })}
            placeholder={draft.conditionScope === "metadata" ? "currentCount" : "severity"}
            className="h-9 w-full"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cond-operator">Operator</Label>
          <Select
            value={draft.conditionOperator}
            onValueChange={(v) =>
              onChange({
                ...draft,
                conditionOperator: v as NotificationRuleConditionOperator,
              })
            }
          >
            <SelectTrigger id="cond-operator" className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPERATOR_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="cond-type">Value type</Label>
          <Select
            value={draft.conditionValueType}
            onValueChange={(v) =>
              onChange({
                ...draft,
                conditionValueType: v as NotificationRuleConditionValueType,
              })
            }
          >
            <SelectTrigger id="cond-type" className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VALUE_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 space-y-1">
          <Label htmlFor="cond-value">Value</Label>
          {draft.conditionValueType === "boolean" ? (
            <Select
              value={draft.conditionValue || "true"}
              onValueChange={(v) => onChange({ ...draft, conditionValue: v })}
            >
              <SelectTrigger id="cond-value" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">true</SelectItem>
                <SelectItem value="false">false</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Input
              id="cond-value"
              type={draft.conditionValueType === "number" ? "number" : "text"}
              value={draft.conditionValue}
              onChange={(event) => onChange({ ...draft, conditionValue: event.target.value })}
              placeholder={draft.conditionValueType === "number" ? "50" : "auth-service"}
              className="h-9 w-full"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function RuleForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<NotificationRuleRow>;
  onSave: (rule: NotificationRuleRow) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<RuleDraft>(() => buildRuleDraft(initial));
  const [saving, setSaving] = useState(false);

  function toggleChannel(channel: NotificationChannel) {
    setDraft((current) => ({
      ...current,
      channels: current.channels.includes(channel)
        ? current.channels.filter((item) => item !== channel)
        : [...current.channels, channel],
    }));
  }

  async function submit() {
    if (!draft.name.trim()) return;
    const condition = buildRuleCondition(draft);
    if (draft.conditionEnabled && !condition) return;
    setSaving(true);
    try {
      const now = nowSeconds();
      await onSave({
        id: initial?.id ?? crypto.randomUUID(),
        name: draft.name.trim(),
        enabled: initial?.enabled ?? true,
        source: draft.source.trim() || null,
        eventType: draft.eventType.trim() || null,
        severity: draft.severity || null,
        projectSlug: initial?.projectSlug ?? null,
        condition,
        channels: draft.channels.length > 0 ? draft.channels : ["in_app"],
        createdAt: initial?.createdAt ?? now,
        updatedAt: now,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 rounded-item border border-border bg-surface p-4">
      <div className="font-mono text-foreground-secondary text-w-sm uppercase tracking-wider">
        {initial?.id ? "Edit Rule" : "New Rule"}
      </div>

      <RuleTemplatePicker
        onApply={(next) =>
          setDraft((current) => ({
            ...current,
            ...buildRuleDraft(next),
            name: next.name ?? current.name,
          }))
        }
      />

      <div className="space-y-1">
        <Label htmlFor="rule-name">Name</Label>
        <Input
          id="rule-name"
          type="text"
          value={draft.name}
          onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
          placeholder="e.g. Critical Sentry errors"
          className="h-9 w-full"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="rule-source">Source</Label>
          <Input
            id="rule-source"
            type="text"
            value={draft.source}
            onChange={(event) =>
              setDraft((current) => ({ ...current, source: event.target.value }))
            }
            placeholder="e.g. sentry (blank = all)"
            className="h-9 w-full"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="rule-event">Event type</Label>
          <Input
            id="rule-event"
            type="text"
            value={draft.eventType}
            onChange={(event) =>
              setDraft((current) => ({ ...current, eventType: event.target.value }))
            }
            placeholder="e.g. error.* (glob ok)"
            className="h-9 w-full"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="rule-severity">Min severity (blank = all)</Label>
        <Select
          value={draft.severity || "all"}
          onValueChange={(v) =>
            setDraft((current) => ({
              ...current,
              severity: (v === "all" ? "" : v) as NotificationSeverity | "",
            }))
          }
        >
          <SelectTrigger id="rule-severity" className="h-9 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            {SEVERITY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <div className="font-mono text-dim text-w-sm uppercase tracking-wider">
          Delivery channels
        </div>
        <div className="flex flex-wrap gap-2">
          {CHANNEL_OPTIONS.map((ch) => (
            <div key={ch} className="flex items-center gap-2">
              <Switch
                checked={draft.channels.includes(ch)}
                onCheckedChange={() => toggleChannel(ch)}
                aria-label={`Toggle ${ch} delivery channel`}
              />
              <span className="font-mono text-dim text-w-sm">{ch}</span>
            </div>
          ))}
        </div>
      </div>

      <RuleConditionBuilder draft={draft} onChange={setDraft} />

      <div className="flex gap-2 pt-1">
        <Button
          type="button"
          onClick={() =>
            submit().catch(() => {
              /* fire-and-forget */
            })
          }
          disabled={!draft.name.trim() || saving}
          className="uppercase-none h-auto px-3 py-1.5 font-mono text-w-sm disabled:opacity-40"
        >
          {saving ? <Loader2 className="icon-xs mr-1.5 animate-spin" /> : null}
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="uppercase-none h-auto px-3 py-1.5 font-mono text-dim text-w-sm hover:text-foreground-secondary"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

function RulesSection() {
  const { rules, loading, saveRule, deleteRule } = useNotificationRules();
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  if (loading) return <EmptyState message="Loading rules…" />;

  return (
    <div className="space-y-3">
      {rules.length === 0 && !creating && (
        <EmptyState message="No custom rules yet. Add one to filter and route events precisely." />
      )}

      {rules.map((rule) =>
        editing === rule.id ? (
          <RuleForm
            key={rule.id}
            initial={rule}
            onSave={async (next) => {
              await saveRule(next);
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <div
            key={rule.id}
            className="min-w-0 space-y-2 rounded-item border border-border bg-surface p-4"
          >
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-mono text-foreground-secondary text-w-base">
                  {rule.name}
                </div>
                <div className="truncate text-dim text-w-sm">
                  {[rule.source, rule.eventType, rule.severity].filter(Boolean).join(" · ") ||
                    "All events"}
                  {" → "}
                  {rule.channels.join(", ")}
                </div>
                {rule.condition ? (
                  <div className="mt-1 truncate text-accent text-w-sm">
                    {summarizeCondition(rule.condition)}
                  </div>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(rule.id)}
                  className="uppercase-none h-auto p-0 font-mono text-dim text-w-sm hover:bg-transparent hover:text-foreground-secondary"
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteRule(rule.id)}
                  className="uppercase-none h-7 w-7 text-destructive/60 hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Delete rule"
                >
                  <Trash2 className="icon-xs" />
                </Button>
              </div>
            </div>
            <div
              className={cn(
                "inline-flex rounded-item border px-2 py-0.5 font-mono text-w-sm uppercase tracking-wider",
                rule.enabled
                  ? "border-success/20 bg-success/10 text-success"
                  : "border-border bg-secondary text-dim"
              )}
            >
              {rule.enabled ? "Active" : "Disabled"}
            </div>
          </div>
        )
      )}

      {creating ? (
        <RuleForm
          onSave={async (next) => {
            await saveRule(next);
            setCreating(false);
          }}
          onCancel={() => setCreating(false)}
        />
      ) : (
        <Button
          type="button"
          variant="ghost"
          onClick={() => setCreating(true)}
          className="uppercase-none flex h-auto w-full items-center gap-2 rounded-item border border-border border-dashed bg-transparent px-4 py-3 font-mono text-dim text-w-sm hover:border-accent/40 hover:text-muted-foreground"
        >
          <Plus className="icon-xs" />
          Add rule
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Webhooks tab — outbound endpoint management
// ---------------------------------------------------------------------------

const ALL_EVENTS_GLOB = ["*"];

function WebhookForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<Omit<WebhookEndpointRow, "secret">>;
  onSave: (endpoint: WebhookEndpointRow) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(() => ({
    name: initial?.name ?? "",
    url: initial?.url ?? "",
    secret: generateSecret(),
    eventsRaw: (initial?.events ?? ALL_EVENTS_GLOB).join(", "),
  }));
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  async function copySecret() {
    const { copyText } = await import("@/lib/clipboard");
    await copyText(form.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function submit() {
    if (!form.name.trim() || !form.url.trim()) return;
    setSaving(true);
    try {
      await onSave({
        id: initial?.id ?? crypto.randomUUID(),
        name: form.name.trim(),
        url: form.url.trim(),
        secret: form.secret,
        events: form.eventsRaw
          .split(",")
          .map((e) => e.trim())
          .filter(Boolean),
        enabled: initial?.enabled ?? true,
        createdAt: initial?.createdAt ?? nowSeconds(),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 rounded-item border border-border bg-surface p-4">
      <div className="font-mono text-foreground-secondary text-w-sm uppercase tracking-wider">
        {initial?.id ? "Edit Endpoint" : "New Webhook Endpoint"}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="webhook-name">Name</Label>
          <Input
            id="webhook-name"
            type="text"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="e.g. Slack alerts"
            className="h-9 w-full"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="webhook-url">URL</Label>
          <Input
            id="webhook-url"
            type="url"
            value={form.url}
            onChange={(event) => setForm((current) => ({ ...current, url: event.target.value }))}
            placeholder="https://hooks.slack.com/…"
            className="h-9 w-full"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="webhook-filter">Event filter (glob, comma-separated)</Label>
        <Input
          id="webhook-filter"
          type="text"
          value={form.eventsRaw}
          onChange={(event) =>
            setForm((current) => ({ ...current, eventsRaw: event.target.value }))
          }
          placeholder="* or deploy.*, error.spike"
          className="h-9 w-full"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="webhook-secret">
          Signing secret (HMAC-SHA256) — copy now, not shown again
        </Label>
        <div className="flex gap-2">
          <div className="flex-1 select-all truncate rounded-item border border-border bg-background px-2.5 py-2 font-mono text-foreground-secondary text-w-sm">
            {form.secret}
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              copySecret().catch(() => {
                /* fire-and-forget */
              })
            }
            className="uppercase-none h-auto px-3 text-dim hover:text-foreground-secondary"
            aria-label="Copy secret"
          >
            {copied ? (
              <span className="text-success text-w-sm">Copied</span>
            ) : (
              <Copy className="icon-xs" />
            )}
          </Button>
        </div>
        <div className="text-dim text-w-sm">
          Verify payloads with header:{" "}
          <code className="text-dim">X-Radarboard-Signature: sha256=&lt;hex&gt;</code>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button
          type="button"
          onClick={() =>
            submit().catch(() => {
              /* fire-and-forget */
            })
          }
          disabled={!form.name.trim() || !form.url.trim() || saving}
          className="uppercase-none h-auto px-3 py-1.5 font-mono text-w-sm disabled:opacity-40"
        >
          {saving ? <Loader2 className="icon-xs mr-1.5 animate-spin" /> : null}
          {saving ? "Saving…" : "Add endpoint"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="uppercase-none h-auto px-3 py-1.5 font-mono text-dim text-w-sm hover:text-foreground-secondary"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

function WebhooksSection() {
  const { endpoints, loading, saveEndpoint, deleteEndpoint, testEndpoint } = useWebhookEndpoints();
  const [creating, setCreating] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, string>>({});

  if (loading) return <EmptyState message="Loading webhook endpoints…" />;

  return (
    <div className="space-y-3">
      <div className="text-dim text-w-sm leading-relaxed">
        Radarboard signs outbound payloads with HMAC-SHA256.{" "}
        <span className="text-dim">
          Email and full webhook delivery channels are coming — see docs/notifications/channels.md
          for implementation details.
        </span>
      </div>

      {endpoints.length === 0 && !creating && (
        <EmptyState message="No webhook endpoints configured. Add one to forward notifications to Slack, Discord, Zapier, or any HTTP endpoint." />
      )}

      {endpoints.map((ep) => (
        <div
          key={ep.id}
          className="min-w-0 space-y-2 rounded-item border border-border bg-surface p-4"
        >
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-mono text-foreground-secondary text-w-base">
                {ep.name}
              </div>
              <div className="truncate text-dim text-w-sm">{ep.url}</div>
              <div className="mt-0.5 truncate text-dim text-w-sm">
                Events: {ep.events.join(", ")}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span
                className={cn(
                  "rounded-item border px-2 py-0.5 font-mono text-w-sm uppercase",
                  ep.enabled
                    ? "border-success/20 bg-success/10 text-success"
                    : "border-border bg-secondary text-dim"
                )}
              >
                {ep.enabled ? "Active" : "Disabled"}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={async () => {
                  setTestingId(ep.id);
                  try {
                    const result = await testEndpoint(ep.id);
                    setTestResults((current) => ({
                      ...current,
                      [ep.id]: result.ok
                        ? `OK${result.status ? ` (${result.status})` : ""}`
                        : `Failed${result.status ? ` (${result.status})` : ""}`,
                    }));
                  } catch (error) {
                    setTestResults((current) => ({
                      ...current,
                      [ep.id]: error instanceof Error ? error.message : "Test failed",
                    }));
                  } finally {
                    setTestingId(null);
                  }
                }}
                className="uppercase-none h-auto p-0 font-mono text-accent text-w-sm hover:bg-transparent hover:text-accent"
              >
                {testingId === ep.id ? "Testing…" : "Test"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => deleteEndpoint(ep.id)}
                className="uppercase-none h-7 w-7 text-destructive/60 hover:bg-destructive/10 hover:text-destructive"
                aria-label="Delete endpoint"
              >
                <Trash2 className="icon-xs" />
              </Button>
            </div>
            {testResults[ep.id] ? (
              <div className="truncate font-mono text-dim text-w-sm">{testResults[ep.id]}</div>
            ) : null}
          </div>
        </div>
      ))}

      {creating ? (
        <WebhookForm
          onSave={async (next) => {
            await saveEndpoint(next);
            setCreating(false);
          }}
          onCancel={() => setCreating(false)}
        />
      ) : (
        <Button
          type="button"
          variant="ghost"
          onClick={() => setCreating(true)}
          className="uppercase-none flex h-auto w-full items-center gap-2 rounded-item border border-border border-dashed bg-transparent px-4 py-3 font-mono text-dim text-w-sm hover:border-accent/40 hover:text-muted-foreground"
        >
          <Plus className="icon-xs" />
          Add webhook endpoint
        </Button>
      )}
    </div>
  );
}

interface SourceCategorySection {
  id: string;
  label: string;
  preferences: NotificationPreferenceRow[];
}

function groupPreferencesByCategory(
  preferences: NotificationPreferenceRow[],
  serviceCategoryMap: Map<string, string>
): SourceCategorySection[] {
  const systemPrefs: NotificationPreferenceRow[] = [];
  const categoryBuckets = new Map<string, NotificationPreferenceRow[]>();

  for (const pref of preferences) {
    if (pref.id === "global" || pref.id === "alerts") {
      systemPrefs.push(pref);
      continue;
    }
    const catId = serviceCategoryMap.get(pref.id) ?? "uncategorized";
    const bucket = categoryBuckets.get(catId) ?? [];
    bucket.push(pref);
    categoryBuckets.set(catId, bucket);
  }

  const sections: SourceCategorySection[] = [];

  if (systemPrefs.length > 0) {
    sections.push({ id: "system", label: "System", preferences: systemPrefs });
  }

  for (const catId of CATEGORY_ORDER) {
    const prefs = categoryBuckets.get(catId);
    if (prefs && prefs.length > 0) {
      sections.push({
        id: catId,
        label: INTEGRATION_CATEGORY_LABELS[catId] ?? catId,
        preferences: prefs,
      });
      categoryBuckets.delete(catId);
    }
  }

  for (const [catId, prefs] of categoryBuckets.entries()) {
    if (prefs.length > 0) {
      sections.push({
        id: catId,
        label: catId.charAt(0).toUpperCase() + catId.slice(1),
        preferences: prefs,
      });
    }
  }

  return sections;
}

function NotificationsTabContent({
  activeTab,
  error,
  loading,
  filteredPreferences,
  serviceCategoryMap,
  savingIds,
  handleChange,
  globalPreference,
  savePreference,
}: {
  activeTab: Tab;
  error: string | null;
  loading: boolean;
  filteredPreferences: NotificationPreferenceRow[];
  serviceCategoryMap: Map<string, string>;
  savingIds: Record<string, boolean>;
  handleChange: (next: NotificationPreferenceRow) => void;
  globalPreference: NotificationPreferenceRow;
  savePreference: (pref: NotificationPreferenceRow) => Promise<void>;
}) {
  if (error) {
    return <EmptyState message={`Failed to load notification settings: ${error}`} />;
  }

  switch (activeTab) {
    case "sources": {
      if (loading && filteredPreferences.length === 0) {
        return <EmptyState message="Loading…" />;
      }
      if (filteredPreferences.length === 0) {
        return <EmptyState message="No sources match your search." />;
      }
      const sections = groupPreferencesByCategory(filteredPreferences, serviceCategoryMap);
      return (
        <>
          <PollingSourceControls
            sourceIds={["notifications-badge", "notifications-feed"]}
            description="Control how often Radarboard refreshes notification counts and the notification center when live updates are unavailable."
            sourceHints={{
              "notifications-badge": "Used for unread counts in the app chrome.",
              "notifications-feed": "Used for the notification center feed.",
            }}
          />

          {sections.map((section) => (
            <div key={section.id}>
              <div className="mb-3 flex items-center justify-between">
                <span className="font-mono text-foreground-secondary text-w-sm uppercase tracking-widest">
                  {section.label}
                </span>
                <span className="rounded-item border border-border bg-card px-2 py-0.5 font-mono text-muted-foreground text-w-sm">
                  {section.preferences.filter((p) => p.enabled).length} enabled
                </span>
              </div>
              <SettingsGrid>
                {section.preferences.map((pref) => (
                  <PreferenceCard
                    key={pref.id}
                    preference={pref}
                    saving={Boolean(savingIds[pref.id])}
                    onChange={handleChange}
                  />
                ))}
              </SettingsGrid>
            </div>
          ))}
        </>
      );
    }
    case "channels":
      return (
        <SettingsGrid>
          <GlobalChannelsCard globalPreference={globalPreference} onSave={savePreference} />
          <DesktopPermissionCard globalPreference={globalPreference} onSave={savePreference} />
          <SoundChannelCard globalPreference={globalPreference} onSave={savePreference} />
          <div className="space-y-2 rounded-item border border-border border-dashed bg-secondary/30 p-4">
            <div className="font-mono text-foreground-secondary text-w-base">Rules + channels</div>
            <div className="text-dim text-w-sm">
              Custom rules can also add channels per match. Configure outbound destinations in the
              Webhooks tab.
            </div>
          </div>
        </SettingsGrid>
      );
    case "quiet-hours":
      return <QuietHoursSection globalPreference={globalPreference} onSave={savePreference} />;
    case "rules":
      return <RulesSection />;
    case "webhooks":
      return <WebhooksSection />;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export function SettingsNotifications() {
  const { connectedKeys } = useCredentials();
  const { preferences, loading, error, savePreference } = useNotificationPreferences();
  const [activeTabParam, setActiveTabParam] = useQueryState(
    VIEW_STATE_QUERY_KEYS.notificationsTab,
    parseAsStringLiteral(NOTIFICATIONS_TAB_IDS)
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});
  const activeTab = activeTabParam ?? DEFAULT_NOTIFICATIONS_TAB;

  useEffect(() => {
    if (activeTabParam === activeTab) return;
    setActiveTabParam(activeTab);
  }, [activeTab, activeTabParam, setActiveTabParam]);

  const globalPreference = useMemo(
    () =>
      preferences.find((p) => p.id === "global") ?? {
        id: "global",
        enabled: true,
        preset: "all" as const,
        digestWindow: 300,
        channels: ["in_app"] as NotificationChannel[],
        quietHours: null,
        updatedAt: nowSeconds(),
      },
    [preferences]
  );

  const preferenceMap = useMemo(() => new Map(preferences.map((p) => [p.id, p])), [preferences]);

  const serviceCategoryMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const descriptor of INTEGRATION_REGISTRY.values()) {
      if (descriptor.category) {
        map.set(descriptor.id, descriptor.category);
      }
    }
    return map;
  }, []);

  const sourceIds = useMemo(() => {
    const ids = new Set<string>(["global", "alerts", ...connectedKeys, ...preferenceMap.keys()]);
    return Array.from(ids).sort((a, b) => {
      if (a === "global") return -1;
      if (b === "global") return 1;
      return a.localeCompare(b);
    });
  }, [connectedKeys, preferenceMap]);

  const filteredPreferences = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return sourceIds
      .filter(
        (id) =>
          !query ||
          id.toLowerCase().includes(query) ||
          sourceLabel(id).toLowerCase().includes(query)
      )
      .map((id) => preferenceMap.get(id) ?? defaultPreference(id));
  }, [preferenceMap, searchQuery, sourceIds]);

  const handleChange = useCallback(
    async (next: NotificationPreferenceRow) => {
      setSavingIds((cur) => ({ ...cur, [next.id]: true }));
      try {
        await savePreference(next);
      } finally {
        setSavingIds((cur) => ({ ...cur, [next.id]: false }));
      }
    },
    [savePreference]
  );

  const showSearch = activeTab === "sources";

  return (
    <SettingsPageLayout
      title="Notifications"
      description="Control how Radarboard detects, batches, and delivers notifications."
      showSearch={showSearch}
      searchPlaceholder="Search sources..."
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      headerSlot={
        <SettingsSectionNav
          items={TABS.map((tab) => ({ id: tab.id, label: tab.label }))}
          activeId={activeTab}
          onChange={(value) => {
            if (value) setActiveTabParam(value as Tab);
          }}
        />
      }
    >
      <div className="min-w-0 space-y-5">
        <NotificationsTabContent
          activeTab={activeTab}
          error={error}
          loading={loading}
          filteredPreferences={filteredPreferences}
          serviceCategoryMap={serviceCategoryMap}
          savingIds={savingIds}
          handleChange={handleChange}
          globalPreference={globalPreference}
          savePreference={savePreference}
        />
      </div>
    </SettingsPageLayout>
  );
}
