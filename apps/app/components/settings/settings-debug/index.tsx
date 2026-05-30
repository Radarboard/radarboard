"use client";

import { API_ROUTES } from "@radarboard/types/api-routes";
import type { DebugConfig, DebugNotificationPromotionRule } from "@radarboard/types/database";
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
import { useStore } from "@tanstack/react-store";
import { Plus, Trash2 } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { type FeaturePreferences, listFeatures } from "@/lib/features";
import { settingsStore } from "@/modules/settings/store/settings-store";
import { SettingsPageLayout } from "../settings-page-layout";

const DEFAULT_RULE: DebugNotificationPromotionRule = {
  id: "",
  enabled: true,
  sourcePattern: "api/*",
  eventTypePattern: "*.failed",
  level: "error",
  severity: "warning",
};

function normalizeDebugConfig(value: DebugConfig | undefined): DebugConfig {
  return {
    promotionEnabled: value?.promotionEnabled ?? true,
    metadataRedactionEnabled: value?.metadataRedactionEnabled ?? true,
    additionalRedactedKeys: value?.additionalRedactedKeys ?? [],
    metadataMaxBytes: value?.metadataMaxBytes ?? 8192,
    retentionDays: value?.retentionDays ?? 30,
    promotionRules: value?.promotionRules ?? [],
  };
}

async function fetchSettingsDebugConfig(): Promise<DebugConfig> {
  const res = await fetch(API_ROUTES.settings);
  const data = (await res.json()) as { debugConfig?: DebugConfig; error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `Failed to load settings (${res.status})`);
  }
  return normalizeDebugConfig(data.debugConfig);
}

export function SettingsDebug() {
  const { data, error: loadError } = useSWR(API_ROUTES.settings, fetchSettingsDebugConfig, {
    refreshInterval: 0,
    revalidateOnFocus: false,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [config, setConfig] = useState<DebugConfig | null>(null);

  useEffect(() => {
    if (!data) return;
    setConfig(data);
  }, [data]);

  const save = useCallback(async () => {
    if (!config) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(API_ROUTES.settings, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ debugConfig: config }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to save debug settings");
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [config]);

  const redactedKeysText = useMemo(
    () => (config?.additionalRedactedKeys ?? []).join(", "),
    [config]
  );

  if (!config && !loadError) {
    return (
      <SettingsPageLayout title="Debug" description="Loading debug settings…" showSearch={false}>
        <EmptyState message="Loading debug settings…" />
      </SettingsPageLayout>
    );
  }

  if (!config) {
    return (
      <SettingsPageLayout title="Debug" description="Debug settings" showSearch={false}>
        <EmptyState
          message={
            loadError instanceof Error ? loadError.message : "Failed to load debug settings."
          }
        />
      </SettingsPageLayout>
    );
  }

  return (
    <SettingsPageLayout
      title="Debug"
      description="Control durable debug event promotion, metadata hygiene, and retention."
      statusText={`${config.promotionRules?.filter((rule) => rule.enabled).length ?? 0} promotion rules enabled`}
      statusColor="muted"
      showSearch={false}
    >
      <div className="max-w-[820px] space-y-5">
        <DebugPromotionSection config={config} setConfig={setConfig} />
        <DebugMetadataSection
          config={config}
          redactedKeysText={redactedKeysText}
          setConfig={setConfig}
        />
        <DebugRetentionSection config={config} setConfig={setConfig} />
        <FeatureFlagsSection />

        <div className="flex items-center gap-3 pt-2">
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save Debug Settings"}
          </Button>
          {Boolean(saveError) && (
            <span className="font-mono text-destructive text-w-sm">{saveError}</span>
          )}
        </div>
      </div>
    </SettingsPageLayout>
  );
}

function DebugPromotionSection({
  config,
  setConfig,
}: {
  config: DebugConfig;
  setConfig: React.Dispatch<React.SetStateAction<DebugConfig | null>>;
}) {
  return (
    <section className="space-y-4 rounded-panel border border-border bg-surface p-4">
      <div>
        <div className="font-mono text-dim text-w-sm uppercase tracking-widest">Promotion</div>
        <p className="mt-1 text-muted-foreground text-w-sm">
          Let selected debug events generate notifications automatically.
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-card border border-border bg-surface-raised px-4 py-3">
        <div>
          <div className="font-mono text-foreground-secondary text-w-sm">Enable promotion</div>
          <div className="mt-1 font-mono text-dim text-w-sm">
            Master toggle for all debug-to-notification rules.
          </div>
        </div>
        <Switch
          checked={config.promotionEnabled ?? true}
          onCheckedChange={(checked) =>
            setConfig((current) =>
              current
                ? {
                    ...current,
                    promotionEnabled: checked,
                  }
                : current
            )
          }
          aria-label="Enable promotion"
        />
      </div>

      <div className="space-y-3">
        {(config.promotionRules ?? []).length === 0 ? (
          <div className="rounded-item border border-border border-dashed bg-secondary/30 px-3 py-4 text-center">
            <p className="font-mono text-dim text-w-sm">No promotion rules configured yet.</p>
          </div>
        ) : (
          config.promotionRules?.map((rule, index) => (
            <div
              key={rule.id}
              className="space-y-3 rounded-card border border-border bg-surface-raised p-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor={`rule-id-${index}`}>Rule ID</Label>
                  <Input
                    id={`rule-id-${index}`}
                    value={rule.id}
                    onChange={(event) => updateRule(index, { id: event.target.value }, setConfig)}
                    placeholder="rule id"
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`rule-severity-${index}`}>Severity</Label>
                  <Select
                    value={rule.severity}
                    onValueChange={(v) =>
                      updateRule(
                        index,
                        {
                          severity: v as DebugNotificationPromotionRule["severity"],
                        },
                        setConfig
                      )
                    }
                  >
                    <SelectTrigger id={`rule-severity-${index}`} className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="critical">critical</SelectItem>
                      <SelectItem value="warning">warning</SelectItem>
                      <SelectItem value="info">info</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`rule-source-${index}`}>Source Pattern</Label>
                  <Input
                    id={`rule-source-${index}`}
                    value={rule.sourcePattern ?? ""}
                    onChange={(event) =>
                      updateRule(index, { sourcePattern: event.target.value || null }, setConfig)
                    }
                    placeholder="source glob (e.g. api/*)"
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`rule-event-${index}`}>Event Pattern</Label>
                  <Input
                    id={`rule-event-${index}`}
                    value={rule.eventTypePattern ?? ""}
                    onChange={(event) =>
                      updateRule(index, { eventTypePattern: event.target.value || null }, setConfig)
                    }
                    placeholder="event glob (e.g. *.failed)"
                    className="h-8"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <Select
                  value={rule.level ?? "any"}
                  onValueChange={(v) =>
                    updateRule(
                      index,
                      {
                        level: v === "any" ? null : (v as DebugNotificationPromotionRule["level"]),
                      },
                      setConfig
                    )
                  }
                >
                  <SelectTrigger className="h-8 min-w-[120px]" aria-label="Level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">any level</SelectItem>
                    <SelectItem value="debug">debug</SelectItem>
                    <SelectItem value="info">info</SelectItem>
                    <SelectItem value="warn">warn</SelectItem>
                    <SelectItem value="error">error</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-2">
                  <span className="font-mono text-dim text-w-sm">enabled</span>
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={(checked) =>
                      updateRule(index, { enabled: checked }, setConfig)
                    }
                    aria-label="Toggle rule"
                  />
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setConfig((current) =>
                      current
                        ? {
                            ...current,
                            promotionRules: (current.promotionRules ?? []).filter(
                              (_, ruleIndex) => ruleIndex !== index
                            ),
                          }
                        : current
                    )
                  }
                  className="uppercase-none h-8 text-dim transition-colors hover:text-destructive"
                >
                  <Trash2 className="icon-xs" />
                  Remove
                </Button>
              </div>
            </div>
          ))
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setConfig((current) =>
              current
                ? {
                    ...current,
                    promotionRules: [
                      ...(current.promotionRules ?? []),
                      {
                        ...DEFAULT_RULE,
                        id: `rule-${(current.promotionRules?.length ?? 0) + 1}`,
                      },
                    ],
                  }
                : current
            )
          }
          className="uppercase-none h-9 gap-1.5 font-sans"
        >
          <Plus className="icon-xs" />
          Add Rule
        </Button>
      </div>
    </section>
  );
}

function DebugMetadataSection({
  config,
  redactedKeysText,
  setConfig,
}: {
  config: DebugConfig;
  redactedKeysText: string;
  setConfig: React.Dispatch<React.SetStateAction<DebugConfig | null>>;
}) {
  return (
    <section className="space-y-4 rounded-panel border border-border bg-surface p-4">
      <div>
        <div className="font-mono text-dim text-w-sm uppercase tracking-widest">
          Metadata Hygiene
        </div>
        <p className="mt-1 text-muted-foreground text-w-sm">
          Control how sensitive data is handled in debug event payloads.
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-card border border-border bg-surface-raised px-4 py-3">
        <div>
          <div className="font-mono text-foreground-secondary text-w-sm">
            Redact sensitive metadata
          </div>
          <div className="mt-1 font-mono text-dim text-w-sm">
            Mask tokens, secrets, passwords, auth headers, and extra configured keys.
          </div>
        </div>
        <Switch
          checked={config.metadataRedactionEnabled ?? true}
          onCheckedChange={(checked) =>
            setConfig((current) =>
              current
                ? {
                    ...current,
                    metadataRedactionEnabled: checked,
                  }
                : current
            )
          }
          aria-label="Redact sensitive metadata"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="extra-redacted-keys">Extra Redacted Keys</Label>
          <Input
            id="extra-redacted-keys"
            value={redactedKeysText}
            onChange={(event) =>
              setConfig((current) =>
                current
                  ? {
                      ...current,
                      additionalRedactedKeys: event.target.value
                        .split(",")
                        .map((value) => value.trim())
                        .filter(Boolean),
                    }
                  : current
              )
            }
            placeholder="x-api-secret, x-auth-token"
            className="h-9"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="max-metadata-size">Max Metadata Size (Bytes)</Label>
          <Input
            id="max-metadata-size"
            type="number"
            min={256}
            max={65536}
            value={config.metadataMaxBytes ?? 8192}
            onChange={(event) =>
              setConfig((current) =>
                current
                  ? {
                      ...current,
                      metadataMaxBytes: Number(event.target.value) || 8192,
                    }
                  : current
              )
            }
            className="h-9"
          />
        </div>
      </div>
    </section>
  );
}

function DebugRetentionSection({
  config,
  setConfig,
}: {
  config: DebugConfig;
  setConfig: React.Dispatch<React.SetStateAction<DebugConfig | null>>;
}) {
  return (
    <section className="space-y-4 rounded-panel border border-border bg-surface p-4">
      <div>
        <div className="font-mono text-dim text-w-sm uppercase tracking-widest">Retention</div>
        <p className="mt-1 text-muted-foreground text-w-sm">
          How long to keep durable debug events in the database.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="retention-days">Retention Days</Label>
        <Input
          id="retention-days"
          type="number"
          min={1}
          max={3650}
          value={config.retentionDays ?? 30}
          onChange={(event) =>
            setConfig((current) =>
              current
                ? {
                    ...current,
                    retentionDays: Number(event.target.value) || 30,
                  }
                : current
            )
          }
          className="h-9 max-w-[240px]"
        />
      </div>
    </section>
  );
}

function FeatureFlagsSection() {
  const featurePreferences = useStore(settingsStore, (s) => s.featurePreferences);
  const features = listFeatures(featurePreferences as FeaturePreferences);

  return (
    <section className="space-y-4 rounded-panel border border-border bg-surface p-4">
      <div>
        <div className="font-mono text-dim text-w-sm uppercase tracking-widest">Feature Flags</div>
        <p className="mt-1 text-muted-foreground text-w-sm">
          Current state of all feature flags (read-only view).
        </p>
      </div>
      <div className="space-y-2">
        {features.map((f) => (
          <div
            key={f.id}
            className="flex items-center justify-between gap-3 rounded-card border border-border bg-surface-raised px-4 py-2"
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-foreground-secondary text-w-sm">{f.label}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 font-mono text-w-xs",
                  f.tier === "system" ? "bg-warning/10 text-warning" : "bg-accent/10 text-accent"
                )}
              >
                {f.tier}
              </span>
            </div>
            <span
              className={cn(
                "font-mono text-w-sm",
                f.effectiveEnabled ? "text-success" : "text-destructive"
              )}
            >
              {f.effectiveEnabled ? "enabled" : "disabled"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function updateRule(
  index: number,
  patch: Partial<DebugNotificationPromotionRule>,
  setConfig: React.Dispatch<React.SetStateAction<DebugConfig | null>>
) {
  setConfig((current) =>
    current
      ? {
          ...current,
          promotionRules: (current.promotionRules ?? []).map((rule, ruleIndex) =>
            ruleIndex === index ? { ...rule, ...patch } : rule
          ),
        }
      : current
  );
}
