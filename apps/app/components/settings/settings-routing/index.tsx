"use client";

import { useRoutingConfig } from "@radarboard/hooks/use-routing-config";
import type { RoutingAction, RoutingConfig, RoutingRule } from "@radarboard/types/database";
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
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { SettingsGrid, SettingsPageLayout, SettingsStatCard } from "../settings-page-layout";

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

type RuleDraft = {
  name: string;
  enabled: boolean;
  source: string;
  eventType: string;
  severity: "" | "critical" | "warning" | "info" | "success";
  projectSlug: string;
  notifications: RoutingAction;
  ticker: RoutingAction;
};

function buildDraft(initial?: RoutingRule): RuleDraft {
  return {
    name: initial?.name ?? "",
    enabled: initial?.enabled ?? true,
    source: initial?.source ?? "",
    eventType: initial?.eventType ?? "",
    severity: initial?.severity ?? "",
    projectSlug: initial?.projectSlug ?? "",
    notifications: initial?.notifications ?? "inherit",
    ticker: initial?.ticker ?? "inherit",
  };
}

function summarizeRule(rule: RoutingRule): string {
  return [rule.source, rule.eventType, rule.severity, rule.projectSlug].filter(Boolean).join(" · ");
}

function actionTone(action: RoutingAction): string {
  switch (action) {
    case "allow":
      return "bg-success/10 text-success border-success/20";
    case "deny":
      return "bg-destructive/10 text-destructive border-destructive/20";
    default:
      return "bg-secondary text-dim border-border";
  }
}

function moveRule(rules: RoutingRule[], index: number, offset: -1 | 1): RoutingRule[] {
  const nextIndex = index + offset;
  if (nextIndex < 0 || nextIndex >= rules.length) return rules;
  const nextRules = [...rules];
  const [rule] = nextRules.splice(index, 1);
  if (!rule) return rules;
  nextRules.splice(nextIndex, 0, rule);
  return nextRules;
}

function NewRuleCard({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      fullWidth
      uppercase={false}
      rounded-item="none"
      className="flex min-h-[188px] flex-col items-center justify-center gap-2 border border-border border-dashed bg-transparent px-4 py-3 font-mono text-dim text-w-sm hover:border-accent/40 hover:text-muted-foreground"
    >
      <Plus className="icon-sm" />
      Add rule
    </Button>
  );
}

function RuleForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: RoutingRule;
  onSave: (rule: RoutingRule) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<RuleDraft>(() => buildDraft(initial));
  const [saving, setSaving] = useState(false);

  const canSave =
    draft.name.trim().length > 0 &&
    (draft.notifications !== "inherit" || draft.ticker !== "inherit");

  async function submit() {
    if (!canSave) return;
    setSaving(true);
    try {
      const now = nowSeconds();
      await onSave({
        id: initial?.id ?? crypto.randomUUID(),
        name: draft.name.trim(),
        enabled: draft.enabled,
        source: draft.source.trim() || null,
        eventType: draft.eventType.trim() || null,
        severity: draft.severity || null,
        projectSlug: draft.projectSlug.trim() || null,
        condition: initial?.condition ?? null,
        notifications: draft.notifications,
        ticker: draft.ticker,
        createdAt: initial?.createdAt ?? now,
        updatedAt: now,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-w-0 space-y-4 rounded-item border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="font-mono text-foreground-secondary text-w-sm uppercase tracking-wider">
          {initial ? "Edit Rule" : "New Rule"}
        </div>
        <div className="flex items-center gap-2 font-mono text-dim text-w-sm">
          <span>Enabled</span>
          <Switch
            checked={draft.enabled}
            onCheckedChange={(enabled) => setDraft((current) => ({ ...current, enabled }))}
            aria-label="Toggle routing rule"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="rule-name">Name</Label>
        <Input
          id="rule-name"
          type="text"
          value={draft.name}
          onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
          placeholder="e.g. Hide routine deploy noise"
          className="h-9"
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
            placeholder="github, linear, vercel"
            className="h-9"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="rule-event-type">Event type</Label>
          <Input
            id="rule-event-type"
            type="text"
            value={draft.eventType}
            onChange={(event) =>
              setDraft((current) => ({ ...current, eventType: event.target.value }))
            }
            placeholder="deploy.*, pr.merged"
            className="h-9"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="rule-severity">Min severity</Label>
          <Select
            value={draft.severity || "all"}
            onValueChange={(v) =>
              setDraft((current) => ({
                ...current,
                severity: (v === "all" ? "" : v) as RuleDraft["severity"],
              }))
            }
          >
            <SelectTrigger id="rule-severity" className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="rule-project">Project slug</Label>
          <Input
            id="rule-project"
            type="text"
            value={draft.projectSlug}
            onChange={(event) =>
              setDraft((current) => ({ ...current, projectSlug: event.target.value }))
            }
            placeholder="optional"
            className="h-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="rule-notifications">Notifications</Label>
          <Select
            value={draft.notifications}
            onValueChange={(v) =>
              setDraft((current) => ({
                ...current,
                notifications: v as RoutingAction,
              }))
            }
          >
            <SelectTrigger id="rule-notifications" className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inherit">Inherit</SelectItem>
              <SelectItem value="allow">Allow</SelectItem>
              <SelectItem value="deny">Deny</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="rule-ticker">Ticker</Label>
          <Select
            value={draft.ticker}
            onValueChange={(v) =>
              setDraft((current) => ({
                ...current,
                ticker: v as RoutingAction,
              }))
            }
          >
            <SelectTrigger id="rule-ticker" className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inherit">Inherit</SelectItem>
              <SelectItem value="allow">Allow</SelectItem>
              <SelectItem value="deny">Deny</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button
          type="button"
          onClick={() => submit()}
          disabled={!canSave || saving}
          uppercase={false}
          className="h-auto px-3 py-1.5 font-mono text-w-sm"
        >
          {saving ? "Saving..." : "Save"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          uppercase={false}
          className="h-auto px-3 py-1.5 font-mono text-dim text-w-sm hover:text-foreground-secondary"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

function RoutingRuleCard({
  rule,
  index,
  totalRules,
  saving,
  onEdit,
  onMove,
  onDelete,
}: {
  rule: RoutingRule;
  index: number;
  totalRules: number;
  saving: boolean;
  onEdit: () => void;
  onMove: (offset: -1 | 1) => void;
  onDelete: () => void;
}) {
  return (
    <div className="min-w-0 space-y-3 rounded-item border border-border bg-surface p-4">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-mono text-foreground text-w-base">{rule.name}</div>
          <div className="truncate text-dim text-w-sm">
            {summarizeRule(rule) || "All typed events"}
          </div>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-item border px-2 py-0.5 font-mono text-w-sm uppercase tracking-wider",
            rule.enabled
              ? "border-success/20 bg-success/10 text-success"
              : "border-border bg-muted text-dim"
          )}
        >
          {rule.enabled ? "Active" : "Disabled"}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <span
          className={cn(
            "rounded-item border px-2 py-0.5 font-mono text-w-sm uppercase tracking-wider",
            actionTone(rule.notifications)
          )}
        >
          notifications {rule.notifications}
        </span>
        <span
          className={cn(
            "rounded-item border px-2 py-0.5 font-mono text-w-sm uppercase tracking-wider",
            actionTone(rule.ticker)
          )}
        >
          ticker {rule.ticker}
        </span>
      </div>

      <div className="flex items-center gap-2 pt-1 font-mono text-dim text-w-sm">
        <Button
          type="button"
          variant="ghost-link"
          size="sm"
          onClick={onEdit}
          uppercase={false}
          className="font-mono hover:bg-transparent"
        >
          Edit
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => onMove(-1)}
          disabled={index <= 0 || saving}
          uppercase={false}
          className="icon-lg text-dim hover:text-foreground disabled:opacity-30"
          aria-label="Move rule up"
        >
          <ArrowUp className="icon-xs" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => onMove(1)}
          disabled={index === totalRules - 1 || saving}
          uppercase={false}
          className="icon-lg text-dim hover:text-foreground disabled:opacity-30"
          aria-label="Move rule down"
        >
          <ArrowDown className="icon-xs" />
        </Button>
        <Button
          type="button"
          variant="outline-destructive"
          size="icon"
          onClick={onDelete}
          uppercase={false}
          className="icon-lg"
          aria-label="Delete rule"
        >
          <Trash2 className="icon-xs" />
        </Button>
      </div>
    </div>
  );
}

export function SettingsRouting() {
  const { routingConfig, loading, error, saveRoutingConfig } = useRoutingConfig();
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const rules = routingConfig.rules;
  const trimmedQuery = searchQuery.trim().toLowerCase();

  const filteredRules = useMemo(() => {
    if (!trimmedQuery) return rules;
    return rules.filter((rule) =>
      [rule.name, rule.source, rule.eventType, rule.projectSlug].some(
        (value) => typeof value === "string" && value.toLowerCase().includes(trimmedQuery)
      )
    );
  }, [rules, trimmedQuery]);

  const activeRules = rules.filter((rule) => rule.enabled).length;
  const notificationOverrides = rules.filter((rule) => rule.notifications !== "inherit").length;
  const tickerOverrides = rules.filter((rule) => rule.ticker !== "inherit").length;

  async function persist(nextConfig: RoutingConfig) {
    setSaving(true);
    try {
      await saveRoutingConfig(nextConfig);
    } finally {
      setSaving(false);
    }
  }

  async function upsertRule(nextRule: RoutingRule) {
    const nextRules = editingId
      ? rules.map((rule) => (rule.id === nextRule.id ? nextRule : rule))
      : [...rules, nextRule];

    await persist({ rules: nextRules });
    setCreating(false);
    setEditingId(null);
  }

  async function deleteRule(ruleId: string) {
    await persist({ rules: rules.filter((rule) => rule.id !== ruleId) });
    if (editingId === ruleId) setEditingId(null);
  }

  async function reorderRule(index: number, offset: -1 | 1) {
    await persist({ rules: moveRule(rules, index, offset) });
  }

  return (
    <SettingsPageLayout
      title="Routing"
      description="Choose which typed event classes can reach notifications, the activity ticker, both, or neither."
      statusText={`${activeRules}/${rules.length} routing rules active${saving ? " · Saving..." : ""}`}
      statusColor="muted"
      searchPlaceholder="Search routing rules..."
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
    >
      {Boolean(error) && <EmptyState message={`Failed to load routing config: ${error}`} />}
      {!error && loading && <EmptyState message="Loading routing rules..." />}
      {!error && !loading && (
        <div className="space-y-5">
          <SettingsGrid>
            <SettingsStatCard
              label="Active Rules"
              value={String(activeRules)}
              caption="Ordered rules run top to bottom. The last matching allow or deny wins for each surface."
            />
            <SettingsStatCard
              label="Notifications Baseline"
              value={String(notificationOverrides)}
              caption="Defaults still come from notification presets, quiet hours, snoozes, and channel rules unless a routing rule overrides them."
            />
            <SettingsStatCard
              label="Ticker Baseline"
              value={String(tickerOverrides)}
              caption="Defaults still come from ticker source toggles. Routing rules only affect typed GitHub, Linear, and Vercel activity in v1."
            />
          </SettingsGrid>

          {filteredRules.length === 0 && !creating && (
            <EmptyState message="No routing rules match your search yet." />
          )}

          <SettingsGrid>
            {creating ? (
              <RuleForm
                onSave={upsertRule}
                onCancel={() => {
                  setCreating(false);
                  setEditingId(null);
                }}
              />
            ) : (
              <NewRuleCard
                onClick={() => {
                  setCreating(true);
                  setEditingId(null);
                }}
              />
            )}

            {filteredRules.map((rule) => {
              const ruleIndex = rules.findIndex((candidate) => candidate.id === rule.id);

              return editingId === rule.id ? (
                <RuleForm
                  key={rule.id}
                  initial={rule}
                  onSave={upsertRule}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <RoutingRuleCard
                  key={rule.id}
                  rule={rule}
                  index={ruleIndex}
                  totalRules={rules.length}
                  saving={saving}
                  onEdit={() => setEditingId(rule.id)}
                  onMove={(offset) => reorderRule(ruleIndex, offset)}
                  onDelete={() => deleteRule(rule.id)}
                />
              );
            })}
          </SettingsGrid>
        </div>
      )}
    </SettingsPageLayout>
  );
}
