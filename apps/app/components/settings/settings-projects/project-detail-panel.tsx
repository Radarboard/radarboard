"use client";

import { arrayMove } from "@dnd-kit/sortable";
import {
  createDefaultDashboardPage,
  previewDashboardLayoutChange,
} from "@radarboard/hooks/dashboard-layout";
import { useCredentials } from "@radarboard/hooks/use-credentials";
import { useDashboard } from "@radarboard/hooks/use-dashboard";
import { useMcpServers } from "@radarboard/hooks/use-mcp-servers";
import { useSentryProjects } from "@radarboard/hooks/use-sentry-projects";
import { integrationRoute } from "@radarboard/integration-sdk/routes";
import { ALL_PROJECTS_SLUG } from "@radarboard/types/dashboard";
import type {
  DashboardPageConfig,
  LayoutDefinition,
  ProjectLayoutConfig,
} from "@radarboard/types/database";
import type {
  Platform,
  PlatformIntegrations,
  PlatformType,
  Project,
} from "@radarboard/types/project";
import type { ProjectContext } from "@radarboard/types/project-context";
import { VIEW_STATE_QUERY_KEYS } from "@radarboard/types/view-state";
import {
  ConfirmationDialog,
  Dialog,
  DialogBody,
  DialogCancelButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@radarboard/ui/app-dialog";
import { Badge } from "@radarboard/ui/badge";
import { Button } from "@radarboard/ui/button";
import { EmptyState } from "@radarboard/ui/empty-state";
import { Input } from "@radarboard/ui/input";
import { Label } from "@radarboard/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@radarboard/ui/select";
import { Switch } from "@radarboard/ui/switch";
import { cn } from "@radarboard/utils/cn";
import {
  BASIC_3X3,
  generateCellId,
  getLayoutDimensions,
  resolveColSizes,
  resolveColumnRowSizes,
  summarizeColumnRowSizes,
} from "@radarboard/widget-engine/layouts";
import { WIDGET_REGISTRY } from "@radarboard/widget-engine/widgets/registry";
import { ChevronDown, ChevronUp, Copy, LayoutGrid, Plus, Search, Trash2, X } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { RemoteServiceIcon } from "@/components/shared/remote-service-icon";
import { useProjectContext } from "@/hooks/projects/use-project-context";
import type { ProjectIntegrationsMap } from "@/hooks/projects/use-project-integrations";
import { useIntegrationConnections } from "@/hooks/settings/use-integration-connections";
import { getServiceFaviconUrl } from "@/lib/service-favicons";
import { buildHealthCheckSuggestions, inferHealthCheckBaseUrl } from "../health-check-url";
import { ProjectSettingsTabs } from "../project-settings-tabs";
import { ContextEditor, StagePicker } from "../projects/context-editor";
import { RepoPicker } from "../projects/repo-picker";
import type { ServiceEntry } from "../settings-integrations/types";
import {
  collectServices,
  getServiceApiConfigured,
  getServiceConnectionCount,
  getServiceMcpReady,
} from "../settings-integrations/utils";
import { MiniGridPreview } from "../settings-layouts";
import { DuplicateLayoutDialog } from "../settings-layouts/clone-dialog";
import { useDetectedColumns } from "../settings-layouts/preset-picker";
import { ProjectWidgetPlacementModal } from "../settings-project-widgets";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INTEGRATION_META: Record<
  keyof PlatformIntegrations,
  {
    label: string;
    faviconKey: string;
    fields: { key: string; label: string; placeholder?: string }[];
  }
> = {
  revenuecat: {
    label: "RevenueCat",
    faviconKey: "revenuecat",
    fields: [{ key: "projectId", label: "Project ID", placeholder: "rc_prj_..." }],
  },
  appStoreConnect: {
    label: "App Store Connect",
    faviconKey: "app-store-connect",
    fields: [{ key: "appId", label: "App ID", placeholder: "123456789" }],
  },
  openPanel: {
    label: "OpenPanel",
    faviconKey: "openpanel",
    fields: [{ key: "projectId", label: "Project ID", placeholder: "my-project" }],
  },
  googleSearchConsole: {
    label: "Google Search Console",
    faviconKey: "google-search-console",
    fields: [{ key: "siteUrl", label: "Site URL", placeholder: "https://example.com" }],
  },
  healthCheck: {
    label: "Health Check",
    faviconKey: "",
    fields: [
      { key: "url", label: "URL", placeholder: "https://example.com" },
      { key: "expectedStatus", label: "Expected Status", placeholder: "200" },
    ],
  },
  openCollective: {
    label: "Open Collective",
    faviconKey: "opencollective",
    fields: [{ key: "slug", label: "Slug", placeholder: "my-project" }],
  },
  github: {
    label: "GitHub",
    faviconKey: "github",
    fields: [
      { key: "owner", label: "Owner", placeholder: "my-org" },
      { key: "repo", label: "Repo", placeholder: "my-repo" },
    ],
  },
  linear: {
    label: "Linear",
    faviconKey: "linear",
    fields: [
      { key: "teamId", label: "Team ID", placeholder: "TEAM" },
      { key: "labelNames", label: "Label Names", placeholder: "idea, bug" },
    ],
  },
  vercel: {
    label: "Vercel",
    faviconKey: "vercel",
    fields: [{ key: "projectId", label: "Project ID", placeholder: "prj_..." }],
  },
  sentry: {
    label: "Sentry",
    faviconKey: "sentry",
    fields: [{ key: "projectSlug", label: "Project Slug", placeholder: "my-project" }],
  },
  betterstack: {
    label: "Betterstack",
    faviconKey: "betterstack",
    fields: [{ key: "monitorNamePattern", label: "Monitor Name Pattern", placeholder: "my-site*" }],
  },
  npm: {
    label: "npm",
    faviconKey: "",
    fields: [{ key: "packageName", label: "Package Name", placeholder: "@my-org/package" }],
  },
  astro: {
    label: "Astro (ASO)",
    faviconKey: "",
    fields: [
      { key: "appId", label: "App Store ID", placeholder: "6746737093" },
      { key: "store", label: "Store", placeholder: "us" },
    ],
  },
};

const PLATFORM_TYPES: { value: PlatformType; label: string }[] = [
  { value: "ios", label: "iOS App" },
  { value: "android", label: "Android App" },
  { value: "mac", label: "macOS App" },
  { value: "watch", label: "watchOS App" },
  { value: "web_app", label: "Web App" },
  { value: "website", label: "Website" },
];

const PLATFORM_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  PLATFORM_TYPES.map(({ value, label }) => [value, label])
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getUniqueDashboardPageSlug(
  value: string,
  pages: DashboardPageConfig[],
  excludeSlug?: string
): string {
  const baseSlug = generateSlug(value) || "overview";
  const usedSlugs = new Set(
    pages.filter((page) => page.slug !== excludeSlug).map((page) => page.slug)
  );

  if (!usedSlugs.has(baseSlug)) {
    return baseSlug;
  }

  let index = 2;
  while (usedSlugs.has(`${baseSlug}-${index}`)) {
    index += 1;
  }

  return `${baseSlug}-${index}`;
}

function getProjectDashboardPages(
  projectLayouts: Record<string, ProjectLayoutConfig>,
  ownerSlug: string
): DashboardPageConfig[] {
  return projectLayouts[ownerSlug]?.pages ?? [createDefaultDashboardPage()];
}

function sortDashboardLayouts(layouts: ReturnType<typeof useDashboard>["layouts"]) {
  return [...layouts].sort((a, b) => {
    const aIsBasic = a.id.startsWith("basic-");
    const bIsBasic = b.id.startsWith("basic-");

    if (aIsBasic !== bIsBasic) {
      return aIsBasic ? -1 : 1;
    }

    return a.name.localeCompare(b.name);
  });
}

function getLayoutColumnGroupLabel(layout: ReturnType<typeof useDashboard>["layouts"][number]) {
  const { colCount } = getLayoutDimensions(layout);
  return `${colCount} Columns`;
}

function getRecommendedLayouts(
  layouts: ReturnType<typeof useDashboard>["layouts"],
  detectedColumns: 2 | 3 | 4
) {
  return layouts.filter((layout) => getLayoutDimensions(layout).colCount === detectedColumns);
}

type PendingLayoutChange = {
  pageSlug: string;
  nextLayout: LayoutDefinition;
  selectedCellIds: string[];
} & ReturnType<typeof previewDashboardLayoutChange>;

function renderLayoutOption(layout: LayoutDefinition, key?: string) {
  return (
    <SelectItem key={key ?? layout.id} value={layout.id} textValue={layout.name} className="gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <MiniGridPreview layout={layout} size={18} />
        <span className="truncate">{layout.name}</span>
      </div>
    </SelectItem>
  );
}

export function userPlatformIds(
  integrations: ProjectIntegrationsMap,
  projectSlug: string
): string[] {
  return (integrations[projectSlug]?.["@@platforms"]?.ids as string[]) ?? [];
}

export function buildUserPlatform(
  integrations: ProjectIntegrationsMap,
  projectSlug: string,
  platformId: string
): Platform {
  return {
    id: platformId,
    name: (integrations[projectSlug]?.[`@@plat_${platformId}`]?.name as string) ?? platformId,
    type: (integrations[projectSlug]?.[`@@plat_${platformId}`]?.type as PlatformType) ?? "website",
    integrations: {},
  };
}

export function collectOpenPanelProjectIds(
  allProjects: Project[],
  getIntegration: (projectSlug: string, platformId: string, key: string) => unknown
): string[] {
  const ids = new Set<string>();

  for (const project of allProjects) {
    const basePlatforms = project.platforms;
    const addedPlatformIds = (getIntegration(project.slug, "@@platforms", "ids") as string[]) ?? [];
    const userPlatforms = addedPlatformIds.map((platformId) => ({
      id: platformId,
      name: platformId,
      type: "website" as PlatformType,
      integrations: {},
    }));

    for (const platform of [...basePlatforms, ...userPlatforms]) {
      const overrideId = getIntegration(project.slug, platform.id, "openPanel.projectId");
      const platformIntegrations = platform.integrations as PlatformIntegrations;
      const baseOpenPanelConfig = (
        platformIntegrations.openPanel as Record<string, unknown> | undefined
      )?.projectId;
      const projectId =
        typeof overrideId === "string" && overrideId.trim().length > 0
          ? overrideId
          : typeof baseOpenPanelConfig === "string" && baseOpenPanelConfig.trim().length > 0
            ? baseOpenPanelConfig
            : null;

      if (projectId) {
        ids.add(projectId);
      }
    }
  }

  return Array.from(ids).sort((left, right) => left.localeCompare(right));
}

// ---------------------------------------------------------------------------
// IntegrationField / SelectField
// ---------------------------------------------------------------------------

function IntegrationField({
  id,
  label,
  value,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={id} className="mb-0 w-[110px] shrink-0">
        {label}
      </Label>
      <Input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1"
        size="default"
      />
    </div>
  );
}

function SelectField({
  id,
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: SelectOption[];
  placeholder?: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={id} className="mb-0 w-[110px] shrink-0">
        {label}
      </Label>
      <Select value={value || "none"} onValueChange={(val) => onChange(val === "none" ? "" : val)}>
        <SelectTrigger id={id} className="flex-1" size="default">
          <SelectValue placeholder={placeholder ?? "— none —"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">— none —</SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// renderIntegrationField
// ---------------------------------------------------------------------------

function resolveDisplayValue(rawOverride: unknown, rawBase: unknown, isArray: boolean): string {
  if (rawOverride !== null && rawOverride !== undefined)
    return isArray ? (rawOverride as string[]).join(", ") : String(rawOverride);
  if (rawBase !== null && rawBase !== undefined)
    return isArray ? (rawBase as string[]).join(", ") : String(rawBase);
  return "";
}

function buildSelectOptions(knownValues: string[], currentValue: string): SelectOption[] {
  const values =
    currentValue && !knownValues.includes(currentValue)
      ? [...knownValues, currentValue]
      : knownValues;
  return values.map((value) => ({ value, label: value }));
}

function buildOpenPanelSelectOptions(
  remoteProjects: OpenPanelProjectOption[],
  fallbackProjectIds: string[],
  currentValue: string
): SelectOption[] {
  const options: SelectOption[] = [];
  const seen = new Set<string>();

  for (const project of remoteProjects) {
    const value = project.id.trim();
    if (!value || seen.has(value)) continue;

    const label =
      typeof project.name === "string" &&
      project.name.trim().length > 0 &&
      project.name.trim() !== value
        ? `${project.name.trim()} — ${value}`
        : value;

    options.push({ value, label });
    seen.add(value);
  }

  for (const projectId of fallbackProjectIds) {
    if (!projectId || seen.has(projectId)) continue;
    options.push({ value: projectId, label: projectId });
    seen.add(projectId);
  }

  if (currentValue && !seen.has(currentValue)) {
    options.push({ value: currentValue, label: currentValue });
  }

  return options;
}

function renderIntegrationField({
  field,
  integrationKey,
  platform,
  projectSlug,
  baseConfig,
  openPanelProjects,
  openPanelProjectIds,
  gscSiteUrls,
  sentryProjectSlugs,
  getIntegration,
  updateIntegration,
}: {
  field: { key: string; label: string; placeholder?: string };
  integrationKey: keyof PlatformIntegrations;
  platform: Platform;
  projectSlug: string;
  baseConfig: Record<string, unknown> | undefined;
  openPanelProjects: OpenPanelProjectOption[];
  openPanelProjectIds: string[];
  gscSiteUrls: string[];
  sentryProjectSlugs: string[];
  getIntegration: (projectSlug: string, platformId: string, key: string) => unknown;
  updateIntegration: (projectSlug: string, platformId: string, key: string, value: unknown) => void;
}) {
  const isArray = field.key === "labelNames";
  const rawOverride = getIntegration(projectSlug, platform.id, `${integrationKey}.${field.key}`);
  const rawBase = baseConfig?.[field.key];
  const displayValue = resolveDisplayValue(rawOverride, rawBase, isArray);
  const storageKey = `${integrationKey}.${field.key}`;
  const fieldId = `int-${projectSlug}-${platform.id}-${integrationKey}-${field.key}`;

  if (integrationKey === "openPanel" && field.key === "projectId") {
    return (
      <SelectField
        key={field.key}
        id={fieldId}
        label={field.label}
        value={displayValue}
        options={buildOpenPanelSelectOptions(openPanelProjects, openPanelProjectIds, displayValue)}
        placeholder="Select project…"
        onChange={(val) => updateIntegration(projectSlug, platform.id, storageKey, val)}
      />
    );
  }

  if (integrationKey === "googleSearchConsole" && field.key === "siteUrl") {
    return (
      <SelectField
        key={field.key}
        id={fieldId}
        label={field.label}
        value={displayValue}
        options={buildSelectOptions(gscSiteUrls, displayValue)}
        placeholder="Select site…"
        onChange={(val) => updateIntegration(projectSlug, platform.id, storageKey, val)}
      />
    );
  }

  if (integrationKey === "sentry" && field.key === "projectSlug") {
    return (
      <SelectField
        key={field.key}
        id={fieldId}
        label={field.label}
        value={displayValue}
        options={buildSelectOptions(sentryProjectSlugs, displayValue)}
        placeholder="Select project…"
        onChange={(val) => updateIntegration(projectSlug, platform.id, storageKey, val)}
      />
    );
  }

  if (integrationKey === "healthCheck" && field.key === "url") {
    const suggestions = buildHealthCheckSuggestions(platform.type, platform.name, displayValue);
    const placeholder = inferHealthCheckBaseUrl(platform.type, platform.name, displayValue);

    return (
      <div key={field.key} className="space-y-1.5">
        <IntegrationField
          id={fieldId}
          label={field.label}
          value={displayValue}
          placeholder={placeholder ?? field.placeholder}
          onChange={(val) => updateIntegration(projectSlug, platform.id, storageKey, val)}
        />
        {suggestions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pl-[118px]">
            <span className="font-mono text-dim text-w-sm uppercase tracking-wider">
              Suggestions
            </span>
            {suggestions.map((suggestion) => (
              <Button
                key={suggestion}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => updateIntegration(projectSlug, platform.id, storageKey, suggestion)}
                uppercase={false}
                className="h-auto rounded-item px-2 py-0.5 font-mono text-dim text-w-sm transition-colors hover:border-accent/40 hover:text-foreground-secondary"
              >
                {suggestion.replace(/^https?:\/\//, "")}
              </Button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <IntegrationField
      key={field.key}
      id={fieldId}
      label={field.label}
      value={displayValue}
      placeholder={field.placeholder}
      onChange={(val) => {
        const parsed = isArray
          ? val
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : val;
        updateIntegration(projectSlug, platform.id, storageKey, parsed);
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// useGscSites
// ---------------------------------------------------------------------------

interface GscSite {
  siteUrl: string;
  permissionLevel: string;
}

interface OpenPanelProjectOption {
  id: string;
  name: string | null;
}

interface SelectOption {
  value: string;
  label: string;
}

async function gscSitesFetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) return { sites: [] };
  return (await res.json()) as { sites?: GscSite[]; configured?: boolean };
}

function useGscSites() {
  const { data } = useSWR(integrationRoute("google-search-console", "sites"), gscSitesFetcher);

  const sites = data?.sites;
  if (sites && sites.length > 0) {
    return sites.map((s) => s.siteUrl);
  }
  return [];
}

async function openPanelProjectsFetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) return { configured: false, projects: [] };
  return (await res.json()) as {
    configured?: boolean;
    projects?: OpenPanelProjectOption[];
  };
}

function useOpenPanelProjects() {
  const { data } = useSWR(integrationRoute("openpanel", "projects"), openPanelProjectsFetcher);
  const projects = data?.projects;

  if (!data?.configured || !Array.isArray(projects)) {
    return [];
  }

  return projects.filter(
    (project): project is OpenPanelProjectOption =>
      typeof project?.id === "string" && project.id.trim().length > 0
  );
}

// ---------------------------------------------------------------------------
// IntegrationRow
// ---------------------------------------------------------------------------

function IntegrationRow({
  integrationKey,
  platform,
  projectSlug,
  allProjects,
  isBaseKey,
  onRemove,
  getIntegration,
  updateIntegration,
}: {
  integrationKey: keyof PlatformIntegrations;
  platform: Platform;
  projectSlug: string;
  allProjects: Project[];
  isBaseKey: boolean;
  onRemove: (() => void) | undefined;
  getIntegration: (projectSlug: string, platformId: string, key: string) => unknown;
  updateIntegration: (projectSlug: string, platformId: string, key: string, value: unknown) => void;
}) {
  const gscSiteUrls = useGscSites();
  const openPanelProjects = useOpenPanelProjects();
  const { slugs: sentryProjectSlugs } = useSentryProjects();

  const meta = INTEGRATION_META[integrationKey];
  if (!meta) return null;

  const baseConfig = platform.integrations[integrationKey] as Record<string, unknown> | undefined;
  const faviconUrl = meta.faviconKey ? getServiceFaviconUrl(meta.faviconKey, 24) : "";

  const enabledRaw = getIntegration(projectSlug, platform.id, `${integrationKey}._enabled`);
  const isEnabled = enabledRaw === null ? true : Boolean(enabledRaw);

  const openPanelProjectIds = collectOpenPanelProjectIds(allProjects, getIntegration);

  return (
    <div className={cn("transition-opacity", !isEnabled && "opacity-50")}>
      <div className="mb-2 flex items-center gap-2">
        {faviconUrl ? (
          <RemoteServiceIcon src={faviconUrl} alt="" size={14} className="shrink-0 rounded-item" />
        ) : (
          <span className="icon-xs inline-block shrink-0 rounded-item bg-secondary" />
        )}
        <span className="flex-1 font-mono text-muted-foreground text-w-sm uppercase tracking-wider">
          {meta.label}
        </span>

        <Switch
          checked={isEnabled}
          onCheckedChange={(checked) =>
            updateIntegration(projectSlug, platform.id, `${integrationKey}._enabled`, checked)
          }
          aria-label={`${isEnabled ? "Disable" : "Enable"} ${meta.label}`}
        />

        {Boolean(onRemove) && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            uppercase={false}
            className="icon-lg text-dim transition-colors hover:text-destructive"
            aria-label={`${isBaseKey ? "Hide" : "Remove"} ${meta.label}`}
          >
            <X className="icon-xs" />
          </Button>
        )}
      </div>

      {integrationKey === "github" ? (
        <div className="space-y-1.5 pl-5">
          {Boolean(isEnabled) && (
            <RepoPicker
              currentRepo={
                (getIntegration(projectSlug, platform.id, "github") as {
                  owner: string;
                  repo: string;
                  path?: string;
                } | null) ??
                (platform.integrations.github
                  ? {
                      owner: (platform.integrations.github as Record<string, unknown>)
                        .owner as string,
                      repo: (platform.integrations.github as Record<string, unknown>)
                        .repo as string,
                      path: (platform.integrations.github as Record<string, unknown>).path as
                        | string
                        | undefined,
                    }
                  : null)
              }
              onSelect={(repo) => updateIntegration(projectSlug, platform.id, "github", repo)}
            />
          )}
        </div>
      ) : (
        <div className="space-y-1.5 pl-5">
          {Boolean(isEnabled) &&
            meta.fields.map((field) =>
              renderIntegrationField({
                field,
                integrationKey,
                platform,
                projectSlug,
                baseConfig,
                openPanelProjects,
                openPanelProjectIds,
                gscSiteUrls,
                sentryProjectSlugs,
                getIntegration,
                updateIntegration,
              })
            )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AddPlatformForm
// ---------------------------------------------------------------------------

function AddPlatformForm({
  suggestedName,
  onAdd,
  onCancel,
}: {
  suggestedName: string;
  onAdd: (name: string, type: PlatformType) => void;
  onCancel: () => void;
}) {
  const normalizedSuggestedName = suggestedName.trim();
  const [name, setName] = useState(() => normalizedSuggestedName);
  const [type, setType] = useState<PlatformType>("website");
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName((currentName) =>
      currentName.trim().length > 0 ? currentName : normalizedSuggestedName
    );
  }, [normalizedSuggestedName]);

  useEffect(() => {
    if (!nameInputRef.current) return;
    nameInputRef.current.focus();
    if (normalizedSuggestedName.length > 0) {
      nameInputRef.current.select();
    }
  }, [normalizedSuggestedName]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd(name.trim(), type);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-3xl space-y-2 rounded-item border border-border bg-secondary p-3"
    >
      <div className="mb-2 font-mono text-muted-foreground text-w-sm uppercase tracking-wider">
        New Platform
      </div>

      <Input
        type="text"
        ref={nameInputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Platform name…"
        size="lg"
      />

      <Select value={type} onValueChange={(v) => setType(v as PlatformType)}>
        <SelectTrigger size="lg" variant="surface">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PLATFORM_TYPES.map(({ value, label }) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2 pt-1">
        <Button
          type="submit"
          disabled={!name.trim()}
          size="sm"
          uppercase={false}
          className="h-auto px-3 py-1 font-mono text-w-sm"
        >
          Add Platform
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          uppercase={false}
          className="h-auto px-3 py-1 font-mono text-dim text-w-sm hover:text-muted-foreground"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// PlatformIntegrationPickerDialog
// ---------------------------------------------------------------------------

type PlatformIntegrationService = ServiceEntry & {
  integrationKey: keyof PlatformIntegrations;
};

function PlatformIntegrationPickerDialog({
  open,
  onOpenChange,
  availableKeys,
  platformName,
  onAttachIntegration,
  onOpenIntegrationSettings,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableKeys: Set<keyof PlatformIntegrations>;
  platformName: string;
  onAttachIntegration: (key: keyof PlatformIntegrations) => void;
  onOpenIntegrationSettings?: (serviceId: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const { connectedKeys } = useCredentials();
  const { servers: mcpServers } = useMcpServers();
  const { connections } = useIntegrationConnections();

  const services = useMemo(() => {
    return collectServices()
      .filter(
        (service): service is PlatformIntegrationService =>
          typeof service.integrationKey === "string" &&
          service.integrationKey in INTEGRATION_META &&
          availableKeys.has(service.integrationKey)
      )
      .sort((left, right) => {
        const leftConfigured =
          getServiceApiConfigured(left, connections, connectedKeys) ||
          getServiceMcpReady(left, connections, mcpServers);
        const rightConfigured =
          getServiceApiConfigured(right, connections, connectedKeys) ||
          getServiceMcpReady(right, connections, mcpServers);
        if (leftConfigured !== rightConfigured) {
          return rightConfigured ? 1 : -1;
        }

        const connectionDelta =
          getServiceConnectionCount(right, connections) -
          getServiceConnectionCount(left, connections);
        if (connectionDelta !== 0) {
          return connectionDelta;
        }

        return (left.auth.name ?? left.credKey).localeCompare(right.auth.name ?? right.credKey);
      });
  }, [availableKeys, connectedKeys, connections, mcpServers]);

  const filteredServices = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return services;

    return services.filter((service) => {
      const name = (service.auth.name ?? service.credKey).toLowerCase();
      const description = (service.description ?? "").toLowerCase();
      const key = service.credKey.toLowerCase();
      return name.includes(query) || description.includes(query) || key.includes(query);
    });
  }, [searchQuery, services]);

  function handleSelectService(service: PlatformIntegrationService) {
    const isConfigured =
      getServiceApiConfigured(service, connections, connectedKeys) ||
      getServiceMcpReady(service, connections, mcpServers);

    if (isConfigured) {
      onAttachIntegration(service.integrationKey);
    } else {
      onOpenIntegrationSettings?.(service.credKey);
    }

    onOpenChange(false);
    setSearchQuery("");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          setSearchQuery("");
        }
      }}
    >
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Add Integration</DialogTitle>
          <DialogDescription>
            Choose a service for {platformName}. Configured services attach immediately. Services
            not configured yet open their setup screen instead.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <div className="relative">
            <Search className="icon-xs absolute top-1/2 left-3 -translate-y-1/2 text-dim" />
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search integrations..."
              className="pl-9"
              aria-label="Search integrations"
            />
          </div>

          {filteredServices.length === 0 ? (
            <EmptyState
              message={
                services.length === 0
                  ? "No integrations available to add for this platform."
                  : "No integrations match your search."
              }
            />
          ) : (
            <div className="scrollbar-thin grid max-h-80 grid-cols-1 gap-2 overflow-y-auto pr-1">
              {filteredServices.map((service) => {
                const isConfigured =
                  getServiceApiConfigured(service, connections, connectedKeys) ||
                  getServiceMcpReady(service, connections, mcpServers);
                const faviconUrl = getServiceFaviconUrl(service.credKey, 32);

                return (
                  <Button
                    key={service.credKey}
                    type="button"
                    variant="ghost"
                    onClick={() => handleSelectService(service)}
                    aria-label={
                      isConfigured
                        ? `Attach ${service.auth.name ?? service.credKey} to ${platformName}`
                        : `Open ${service.auth.name ?? service.credKey} setup`
                    }
                    uppercase={false}
                    className="h-auto justify-start rounded-item border border-border bg-surface-raised px-3 py-2.5 text-left hover:border-accent/30 hover:bg-surface"
                  >
                    <div className="flex min-w-0 items-start gap-2.5">
                      <div className="relative mt-0.5 shrink-0">
                        {faviconUrl ? (
                          <RemoteServiceIcon src={faviconUrl} alt="" size={18} />
                        ) : (
                          <span className="icon-sm inline-block bg-muted" />
                        )}
                        <span
                          className={cn(
                            "absolute -right-0.5 -bottom-0.5 h-2 w-2 rounded-full border-2 border-surface-raised",
                            isConfigured ? "bg-success" : "bg-dim"
                          )}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-mono text-foreground text-w-sm uppercase tracking-wider">
                            {service.auth.name ?? service.credKey}
                          </span>
                          <Badge
                            variant={isConfigured ? "success" : "outline"}
                            size="xs"
                            className="shrink-0"
                          >
                            {isConfigured ? "Configured" : "Not configured"}
                          </Badge>
                        </div>
                        {service.description ? (
                          <div className="mt-1 line-clamp-2 text-foreground-secondary text-w-sm leading-relaxed">
                            {service.description}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </Button>
                );
              })}
            </div>
          )}
        </DialogBody>
        <DialogFooter className="justify-end">
          <DialogCancelButton onClick={() => onOpenChange(false)}>Close</DialogCancelButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// PlatformSection
// ---------------------------------------------------------------------------

export function PlatformSection({
  platform,
  projectSlug,
  allProjects,
  isUserPlatform,
  onDeletePlatform,
  onOpenIntegrationSettings,
  getIntegration,
  updateIntegration,
}: {
  platform: Platform;
  projectSlug: string;
  allProjects: Project[];
  isUserPlatform: boolean;
  onDeletePlatform: (() => void) | undefined;
  onOpenIntegrationSettings?: (serviceId: string) => void;
  getIntegration: (projectSlug: string, platformId: string, key: string) => unknown;
  updateIntegration: (projectSlug: string, platformId: string, key: string, value: unknown) => void;
}) {
  const [showAddIntegrationDialog, setShowAddIntegrationDialog] = useState(false);
  const [pendingKeys, setPendingKeys] = useState<Set<keyof PlatformIntegrations>>(new Set());
  const [editingName, setEditingName] = useState(false);

  const nameOverride = getIntegration(projectSlug, platform.id, "@@name") as string | null;
  const displayName = nameOverride ?? platform.name;

  const baseKeys = Object.keys(platform.integrations) as (keyof PlatformIntegrations)[];
  const allMeta = Object.keys(INTEGRATION_META) as (keyof PlatformIntegrations)[];

  const hiddenBaseKeys = new Set(
    baseKeys.filter((k) => getIntegration(projectSlug, platform.id, `${k}._hidden`) === true)
  );
  const visibleBaseKeys = baseKeys.filter((k) => !hiddenBaseKeys.has(k));

  const overrideKeys: (keyof PlatformIntegrations)[] = allMeta.filter(
    (k) =>
      !baseKeys.includes(k) &&
      (k === "github"
        ? getIntegration(projectSlug, platform.id, "github") !== null
        : INTEGRATION_META[k]?.fields.some(
            (f) => getIntegration(projectSlug, platform.id, `${k}.${f.key}`) !== null
          ))
  );

  const visibleSet = new Set<keyof PlatformIntegrations>([...visibleBaseKeys, ...overrideKeys]);
  const visibleKeys: (keyof PlatformIntegrations)[] = [
    ...visibleBaseKeys,
    ...overrideKeys,
    ...[...pendingKeys].filter((k) => !visibleSet.has(k)),
  ];

  const availableToAdd = allMeta.filter((k) => !visibleKeys.includes(k) || hiddenBaseKeys.has(k));

  function handleAttachIntegration(key: keyof PlatformIntegrations) {
    if (hiddenBaseKeys.has(key)) {
      updateIntegration(projectSlug, platform.id, `${key}._hidden`, false);
      return;
    }

    setPendingKeys((prev) => new Set([...prev, key]));
  }

  function handleRemoveIntegration(key: keyof PlatformIntegrations, isBase: boolean) {
    if (isBase) {
      updateIntegration(projectSlug, platform.id, `${key}._hidden`, true);
    } else {
      if (key === "github") {
        updateIntegration(projectSlug, platform.id, "github", null);
      } else {
        for (const field of INTEGRATION_META[key]?.fields ?? []) {
          updateIntegration(projectSlug, platform.id, `${key}.${field.key}`, null);
        }
      }
      updateIntegration(projectSlug, platform.id, `${key}._enabled`, null);
      setPendingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  return (
    <div className="overflow-hidden rounded-item border border-border">
      <div className="flex items-center gap-2 bg-surface px-3 py-2">
        {editingName ? (
          <Input
            type="text"
            value={displayName}
            onChange={(e) => updateIntegration(projectSlug, platform.id, "@@name", e.target.value)}
            onBlur={() => setEditingName(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") setEditingName(false);
            }}
            className="flex-1 p-0 font-mono text-w-sm focus-visible:border-accent focus-visible:border-b"
            variant="ghost"
            size="default"
            rounded-item="none"
            aria-label="Platform name"
          />
        ) : (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setEditingName(true)}
            uppercase={false}
            rounded-item="none"
            className="h-auto flex-1 cursor-text justify-start px-0 font-mono font-normal text-foreground-secondary text-w-sm hover:bg-transparent hover:text-foreground"
            aria-label={`Edit platform name: ${displayName}`}
          >
            {displayName}
          </Button>
        )}

        {availableToAdd.length > 0 && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowAddIntegrationDialog(true)}
              uppercase={false}
              className="h-auto border border-border bg-transparent px-2 py-0.5 font-mono text-dim text-w-sm hover:border-accent/40 hover:bg-transparent hover:text-muted-foreground"
            >
              <Plus className="icon-xs mr-1" />
              Add integration
            </Button>
            <PlatformIntegrationPickerDialog
              open={showAddIntegrationDialog}
              onOpenChange={setShowAddIntegrationDialog}
              availableKeys={new Set(availableToAdd)}
              platformName={displayName}
              onAttachIntegration={handleAttachIntegration}
              onOpenIntegrationSettings={onOpenIntegrationSettings}
            />
          </>
        )}

        <Badge variant="secondary" className="shrink-0">
          {PLATFORM_TYPE_LABEL[platform.type] ?? platform.type}
        </Badge>

        {Boolean(isUserPlatform) && onDeletePlatform && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onDeletePlatform}
            uppercase={false}
            className="icon-lg text-dim transition-colors hover:text-destructive"
            aria-label={`Delete platform ${displayName}`}
          >
            <Trash2 className="icon-xs" />
          </Button>
        )}
      </div>

      <div className="space-y-4 border-border border-t bg-background/50 px-3 py-3">
        {visibleKeys.length === 0 && (
          <p className="font-mono text-dim text-w-sm">
            No integrations configured for this platform.
          </p>
        )}
        {visibleKeys.map((integrationKey) => (
          <IntegrationRow
            key={integrationKey}
            integrationKey={integrationKey}
            platform={platform}
            projectSlug={projectSlug}
            allProjects={allProjects}
            isBaseKey={baseKeys.includes(integrationKey)}
            onRemove={() =>
              handleRemoveIntegration(integrationKey, baseKeys.includes(integrationKey))
            }
            getIntegration={getIntegration}
            updateIntegration={updateIntegration}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DashboardPagesSection
// ---------------------------------------------------------------------------

interface ProjectDialogState {
  placementTargetSlug: string | null;
  duplicateSourceSlug: string | null;
  pendingLayoutChangePageSlug: string | null;
  pendingLayoutChangeLayoutId: string | null;
}

interface ProjectDuplicateSource {
  layout: LayoutDefinition;
  pageSlug: string;
  pageName: string;
  assignments: Record<string, string | null>;
}

function readProjectDialogState(projectDialogParam: string | null): ProjectDialogState {
  const layoutChangeMatch = projectDialogParam?.match(/^layout-change:([^:]+):(.+)$/) ?? null;
  return {
    placementTargetSlug: projectDialogParam?.startsWith("widgets:")
      ? projectDialogParam.slice("widgets:".length)
      : null,
    duplicateSourceSlug: projectDialogParam?.startsWith("duplicate:")
      ? projectDialogParam.slice("duplicate:".length)
      : null,
    pendingLayoutChangePageSlug: layoutChangeMatch?.[1] ?? null,
    pendingLayoutChangeLayoutId: layoutChangeMatch?.[2] ?? null,
  };
}

function buildProjectDuplicateSource(
  pages: DashboardPageConfig[],
  sortedLayouts: LayoutDefinition[],
  duplicateSourceSlug: string | null
): ProjectDuplicateSource | null {
  if (duplicateSourceSlug == null) return null;
  const page = pages.find((entry) => entry.slug === duplicateSourceSlug);
  if (!page) return null;
  return {
    layout: sortedLayouts.find((layout) => layout.id === page.layoutId) ?? BASIC_3X3,
    pageSlug: page.slug,
    pageName: page.name,
    assignments: page.widgetLayouts?.[page.layoutId ?? BASIC_3X3.id] ?? {},
  };
}

function buildPendingLayoutChangeBase(
  pages: DashboardPageConfig[],
  sortedLayouts: LayoutDefinition[],
  pendingLayoutChangePageSlug: string | null,
  pendingLayoutChangeLayoutId: string | null
): Omit<PendingLayoutChange, "selectedCellIds"> | null {
  if (pendingLayoutChangePageSlug == null || pendingLayoutChangeLayoutId == null) return null;
  const pendingPage = pages.find((page) => page.slug === pendingLayoutChangePageSlug);
  const pendingNextLayout = sortedLayouts.find(
    (layout) => layout.id === pendingLayoutChangeLayoutId
  );
  if (!pendingPage || !pendingNextLayout) return null;

  const currentLayout =
    sortedLayouts.find((layout) => layout.id === pendingPage.layoutId) ?? BASIC_3X3;
  if (pendingNextLayout.id === currentLayout.id) return null;

  const preview = previewDashboardLayoutChange(
    currentLayout,
    pendingNextLayout,
    pendingPage.widgetLayouts?.[currentLayout.id]
  );

  return {
    ...preview,
    pageSlug: pendingPage.slug,
    nextLayout: pendingNextLayout,
  };
}

function cloneLayoutForProjectPage(
  layout: LayoutDefinition,
  assignments: Record<string, string | null>
): { cloned: LayoutDefinition; remapped: Record<string, string | null> } {
  const cloned: LayoutDefinition = {
    ...layout,
    id: crypto.randomUUID(),
    name: `Copy of ${layout.name}`,
    cells: layout.cells.map((cell) => ({ ...cell, id: generateCellId() })),
    colSizes: [...resolveColSizes(layout)],
    rowSizes: [...summarizeColumnRowSizes(resolveColumnRowSizes(layout))],
    columnRowSizes: resolveColumnRowSizes(layout).map((sizes) => [...sizes]),
  };

  const remapped: Record<string, string | null> = {};
  for (let i = 0; i < layout.cells.length; i++) {
    const src = layout.cells[i];
    const dst = cloned.cells[i];
    if (src && dst) remapped[dst.id] = assignments[src.id] ?? null;
  }

  return { cloned, remapped };
}

function ProjectDashboardPageCard({
  detectedColumns,
  groupedLayouts,
  handleMovePage,
  handleRequestLayoutChange,
  handleUpdatePage,
  index,
  ownerSlug,
  page,
  pages,
  recommendedLayouts,
  removeProjectPage,
  setProjectDialogParam,
  sortedLayouts,
}: {
  detectedColumns: 2 | 3 | 4;
  groupedLayouts: Array<[string, LayoutDefinition[]]>;
  handleMovePage: (pageSlug: string, direction: -1 | 1) => void;
  handleRequestLayoutChange: (page: DashboardPageConfig, nextLayoutId: string) => void;
  handleUpdatePage: (pageSlug: string, page: DashboardPageConfig) => void;
  index: number;
  ownerSlug: string;
  page: DashboardPageConfig;
  pages: DashboardPageConfig[];
  recommendedLayouts: LayoutDefinition[];
  removeProjectPage: (ownerSlug: string, pageSlug: string) => void;
  setProjectDialogParam: (value: string | null) => void;
  sortedLayouts: LayoutDefinition[];
}) {
  const activeLayout = sortedLayouts.find((layout) => layout.id === page.layoutId) ?? BASIC_3X3;
  const layoutValue = sortedLayouts.some((layout) => layout.id === page.layoutId)
    ? (page.layoutId ?? BASIC_3X3.id)
    : BASIC_3X3.id;

  return (
    <div className="overflow-x-hidden rounded-item border border-border bg-surface-raised p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <MiniGridPreview layout={activeLayout} size={54} />

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Input
            type="text"
            value={page.name}
            onChange={(event) =>
              handleUpdatePage(page.slug, {
                ...page,
                name: event.target.value,
                slug: getUniqueDashboardPageSlug(event.target.value, pages, page.slug),
              })
            }
            variant="surface"
            size="lg"
            aria-label="Page name"
            className="min-w-0 lg:max-w-sm xl:max-w-md"
          />

          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <Select value={layoutValue} onValueChange={(v) => handleRequestLayoutChange(page, v)}>
              <SelectTrigger
                size="lg"
                variant="surface"
                aria-label="Page layout"
                className="w-full lg:w-44"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="min-w-56">
                {recommendedLayouts.length > 0 ? (
                  <SelectGroup>
                    <SelectGroupLabel>
                      Recommended
                      <span className="ml-2 text-dim/70 normal-case tracking-normal">
                        {detectedColumns} cols
                      </span>
                    </SelectGroupLabel>
                    {recommendedLayouts.map((layout) =>
                      renderLayoutOption(layout, `recommended-${layout.id}`)
                    )}
                  </SelectGroup>
                ) : null}
                {recommendedLayouts.length > 0 ? <SelectSeparator /> : null}
                {groupedLayouts.map(([label, group], groupIndex) => (
                  <SelectGroup key={label}>
                    <SelectGroupLabel>{label}</SelectGroupLabel>
                    {group.map((layout) => renderLayoutOption(layout))}
                    {groupIndex < groupedLayouts.length - 1 ? <SelectSeparator /> : null}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>

            <div className="flex flex-col gap-1 lg:ml-auto lg:flex-row lg:items-center lg:justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setProjectDialogParam(`widgets:${page.slug}`)}
                uppercase={false}
                className="h-9 w-full min-w-0 border-accent/20 px-2 font-mono text-accent text-w-sm hover:bg-accent/10 hover:text-accent lg:w-auto"
              >
                <LayoutGrid className="icon-xs mr-1" />
                Edit Widgets
              </Button>
              <div className="flex items-center justify-end gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setProjectDialogParam(`duplicate:${page.slug}`)}
                  aria-label={`Duplicate ${page.name}`}
                  title={`Duplicate ${page.name}`}
                  uppercase={false}
                  className="h-8 w-8 text-dim hover:text-foreground"
                >
                  <Copy className="icon-xs" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleMovePage(page.slug, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${page.name} up`}
                  uppercase={false}
                  className="h-8 w-8 text-dim hover:text-foreground disabled:opacity-30"
                >
                  <ChevronUp className="icon-xs" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleMovePage(page.slug, 1)}
                  disabled={index === pages.length - 1}
                  aria-label={`Move ${page.name} down`}
                  uppercase={false}
                  className="h-8 w-8 text-dim hover:text-foreground disabled:opacity-30"
                >
                  <ChevronDown className="icon-xs" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => removeProjectPage(ownerSlug, page.slug)}
                  disabled={pages.length === 1}
                  aria-label={`Delete ${page.name}`}
                  uppercase={false}
                  className="h-8 w-8 border-border text-dim hover:border-destructive/30 hover:text-destructive"
                >
                  <Trash2 className="icon-xs" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-dim text-w-sm sm:pl-16">
        <span>{activeLayout.name}</span>
        <span>•</span>
        <span>{activeLayout.cells.length} cells</span>
      </div>
    </div>
  );
}

function ProjectDashboardPageDialogs({
  addProjectPage,
  duplicateSource,
  layouts,
  ownerName,
  ownerSlug,
  pendingLayoutChange,
  placementLayout,
  placementPage,
  placementTargetSlug,
  projectLayouts,
  projects,
  setPendingSelectionState,
  setProjectDialogParam,
  updateLayouts,
  updateProjectLayout,
  onConfirmPendingLayoutChange,
  onTogglePendingWidget,
}: {
  addProjectPage: (ownerSlug: string, page: DashboardPageConfig) => void;
  duplicateSource: ProjectDuplicateSource | null;
  layouts: LayoutDefinition[];
  ownerName: string;
  ownerSlug: string;
  pendingLayoutChange: PendingLayoutChange | null;
  placementLayout: LayoutDefinition;
  placementPage: DashboardPageConfig | null;
  placementTargetSlug: string | null;
  projectLayouts: Record<string, ProjectLayoutConfig>;
  projects: Project[];
  setPendingSelectionState: (value: { key: string; selectedCellIds: string[] } | null) => void;
  setProjectDialogParam: (value: string | null) => void;
  updateLayouts: (layouts: LayoutDefinition[]) => void;
  updateProjectLayout: (projectSlug: string, layout: ProjectLayoutConfig) => void;
  onConfirmPendingLayoutChange: () => void;
  onTogglePendingWidget: (cellId: string) => void;
}) {
  return (
    <>
      <DuplicateLayoutDialog
        open={duplicateSource !== null}
        onOpenChange={(open) => !open && setProjectDialogParam(null)}
        layout={duplicateSource?.layout ?? BASIC_3X3}
        sourceProjectName={ownerName}
        sourcePageName={duplicateSource?.pageName ?? ""}
        projects={projects}
        onDuplicate={(target, pageName) => {
          if (!duplicateSource) return;
          const { cloned, remapped } = cloneLayoutForProjectPage(
            duplicateSource.layout,
            duplicateSource.assignments
          );

          const updatedLayouts = [...layouts, cloned];
          updateLayouts(updatedLayouts);

          const newPage = createDefaultDashboardPage(
            { name: pageName, layoutId: cloned.id, widgetLayouts: { [cloned.id]: remapped } },
            updatedLayouts
          );

          if (target.type === "same-project") {
            addProjectPage(ownerSlug, newPage);
          } else if (target.type === "existing-project") {
            addProjectPage(target.projectSlug, newPage);
          } else {
            const slug = target.projectName
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "");
            updateProjectLayout(slug, {
              ...(projectLayouts[slug] ?? {}),
              pages: [...(projectLayouts[slug]?.pages ?? []), newPage],
            });
          }

          toast.success(`Layout duplicated as "${pageName}"`);
          setProjectDialogParam(null);
        }}
      />

      {placementPage ? (
        <ProjectWidgetPlacementModal
          open={placementTargetSlug !== null}
          onOpenChange={(open) => !open && setProjectDialogParam(null)}
          projectSlug={ownerSlug}
          projectName={ownerName}
          pageSlug={placementPage.slug}
          pageName={placementPage.name}
          layout={placementLayout}
        />
      ) : null}

      <Dialog
        open={pendingLayoutChange !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingSelectionState(null);
            setProjectDialogParam(null);
          }
        }}
      >
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Choose Widgets to Keep</DialogTitle>
            <DialogDescription>
              {pendingLayoutChange
                ? `${pendingLayoutChange.nextLayout.name} can keep up to ${pendingLayoutChange.keepCapacity} widget${pendingLayoutChange.keepCapacity === 1 ? "" : "s"}. Select which ones should remain on this page.`
                : "Select which widgets should remain on this page."}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="mb-3 flex items-center justify-between font-mono text-dim text-w-sm">
              <span>
                Keeping {pendingLayoutChange?.selectedCellIds.length ?? 0} of{" "}
                {pendingLayoutChange?.keepCapacity ?? 0}
              </span>
              <span>{pendingLayoutChange?.droppedCellIds.length ?? 0} would be removed</span>
            </div>
            <div className="space-y-2">
              {pendingLayoutChange?.assignedWidgets.map((entry) => {
                const isSelected = pendingLayoutChange.selectedCellIds.includes(entry.cellId);
                const isDisabled =
                  !isSelected &&
                  pendingLayoutChange.selectedCellIds.length >= pendingLayoutChange.keepCapacity;
                const widgetName = WIDGET_REGISTRY.get(entry.widgetId)?.name ?? entry.widgetId;

                return (
                  <label
                    key={entry.cellId}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-item border border-border bg-surface px-3 py-2 transition-interactive",
                      isSelected ? "border-accent bg-surface-raised" : "hover:border-accent/40",
                      isDisabled && "cursor-not-allowed opacity-60"
                    )}
                  >
                    <span className="sr-only">{`Keep ${widgetName}`}</span>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={isDisabled}
                      onChange={() => onTogglePendingWidget(entry.cellId)}
                      className="h-4 w-4 accent-[var(--color-accent)]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-mono text-foreground text-w-sm">
                        {widgetName}
                      </div>
                      <div className="font-mono text-dim text-w-xs uppercase tracking-wider">
                        {entry.cellId}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </DialogBody>
          <DialogFooter className="justify-end">
            <DialogCancelButton
              onClick={() => {
                setPendingSelectionState(null);
                setProjectDialogParam(null);
              }}
            >
              Cancel
            </DialogCancelButton>
            <Button
              type="button"
              onClick={onConfirmPendingLayoutChange}
              disabled={
                pendingLayoutChange == null ||
                pendingLayoutChange.selectedCellIds.length > pendingLayoutChange.keepCapacity
              }
            >
              Apply Layout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DashboardPagesSection({ ownerSlug, ownerName }: { ownerSlug: string; ownerName: string }) {
  const [projectDialogParam, setProjectDialogParam] = useQueryState(
    VIEW_STATE_QUERY_KEYS.projectDialog,
    parseAsString
  );
  const [pendingSelectionState, setPendingSelectionState] = useState<{
    key: string;
    selectedCellIds: string[];
  } | null>(null);
  const detectedColumns = useDetectedColumns();
  const {
    layouts,
    projects,
    projectLayouts,
    updateLayouts,
    addProjectPage,
    updateProjectPage,
    updateProjectLayout,
    removeProjectPage,
    reorderProjectPages,
  } = useDashboard();
  const sortedLayouts = sortDashboardLayouts(layouts);
  const recommendedLayouts = getRecommendedLayouts(sortedLayouts, detectedColumns);
  const recommendedLayoutIds = new Set(recommendedLayouts.map((layout) => layout.id));
  const groupedLayouts = Array.from(
    sortedLayouts.reduce((groups, layout) => {
      if (recommendedLayoutIds.has(layout.id)) {
        return groups;
      }
      const label = getLayoutColumnGroupLabel(layout);
      const existing = groups.get(label);
      if (existing) {
        existing.push(layout);
      } else {
        groups.set(label, [layout]);
      }
      return groups;
    }, new Map<string, typeof sortedLayouts>())
  );

  const pages = getProjectDashboardPages(projectLayouts, ownerSlug);
  const {
    placementTargetSlug,
    duplicateSourceSlug,
    pendingLayoutChangePageSlug,
    pendingLayoutChangeLayoutId,
  } = readProjectDialogState(projectDialogParam);
  const placementPage = pages.find((page) => page.slug === placementTargetSlug) ?? null;
  const pendingPage = pages.find((page) => page.slug === pendingLayoutChangePageSlug) ?? null;
  const placementLayout =
    (placementPage ? sortedLayouts.find((layout) => layout.id === placementPage.layoutId) : null) ??
    BASIC_3X3;
  const duplicateSource = buildProjectDuplicateSource(pages, sortedLayouts, duplicateSourceSlug);
  const basePendingLayoutChange = buildPendingLayoutChangeBase(
    pages,
    sortedLayouts,
    pendingLayoutChangePageSlug,
    pendingLayoutChangeLayoutId
  );
  const pendingLayoutKey =
    basePendingLayoutChange == null
      ? null
      : `${basePendingLayoutChange.pageSlug}:${basePendingLayoutChange.nextLayout.id}`;
  const pendingLayoutChange =
    basePendingLayoutChange == null
      ? null
      : {
          ...basePendingLayoutChange,
          selectedCellIds:
            pendingSelectionState?.key === pendingLayoutKey
              ? pendingSelectionState.selectedCellIds
              : basePendingLayoutChange.preservedCellIds,
        };
  const shouldResetProjectDialog =
    (placementTargetSlug !== null && placementPage === null) ||
    (duplicateSourceSlug !== null && duplicateSource === null) ||
    (pendingLayoutChangePageSlug !== null &&
      pendingLayoutChangeLayoutId !== null &&
      basePendingLayoutChange === null);

  function handleAddPage() {
    const name = `Page ${pages.length + 1}`;
    addProjectPage(
      ownerSlug,
      createDefaultDashboardPage({
        name,
        slug: getUniqueDashboardPageSlug(name, pages),
      })
    );
  }

  function handleUpdatePage(pageSlug: string, page: DashboardPageConfig) {
    updateProjectPage(ownerSlug, pageSlug, page);
  }

  function handleMovePage(pageSlug: string, direction: -1 | 1) {
    const index = pages.findIndex((page) => page.slug === pageSlug);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= pages.length) return;
    reorderProjectPages(ownerSlug, arrayMove(pages, index, nextIndex));
  }

  function applyLayoutChange(
    page: DashboardPageConfig,
    nextLayout: LayoutDefinition,
    allowedCellIds?: Set<string>
  ) {
    const currentLayout = sortedLayouts.find((layout) => layout.id === page.layoutId) ?? BASIC_3X3;
    const preview = previewDashboardLayoutChange(
      currentLayout,
      nextLayout,
      page.widgetLayouts?.[currentLayout.id],
      allowedCellIds
    );

    updateProjectPage(ownerSlug, page.slug, {
      ...page,
      layoutId: nextLayout.id,
      widgetLayouts: {
        ...(page.widgetLayouts ?? {}),
        [nextLayout.id]: preview.nextAssignments,
      },
    });
    toast.success(`Layout changed to ${nextLayout.name}`);
  }

  function handleRequestLayoutChange(page: DashboardPageConfig, nextLayoutId: string) {
    const currentLayout = sortedLayouts.find((layout) => layout.id === page.layoutId) ?? BASIC_3X3;
    const nextLayout = sortedLayouts.find((layout) => layout.id === nextLayoutId);

    if (!nextLayout || nextLayout.id === currentLayout.id) return;

    const preview = previewDashboardLayoutChange(
      currentLayout,
      nextLayout,
      page.widgetLayouts?.[currentLayout.id]
    );

    if (preview.droppedCellIds.length === 0) {
      applyLayoutChange(page, nextLayout);
      return;
    }

    setPendingSelectionState({
      key: `${page.slug}:${nextLayout.id}`,
      selectedCellIds: preview.preservedCellIds,
    });
    setProjectDialogParam(`layout-change:${page.slug}:${nextLayout.id}`);
  }

  function togglePendingWidget(cellId: string) {
    if (!pendingLayoutChange) return;

    const selected = new Set(pendingLayoutChange.selectedCellIds);
    if (selected.has(cellId)) {
      selected.delete(cellId);
    } else {
      if (selected.size >= pendingLayoutChange.keepCapacity) return;
      selected.add(cellId);
    }

    setPendingSelectionState({
      key:
        pendingLayoutKey ?? `${pendingLayoutChange.pageSlug}:${pendingLayoutChange.nextLayout.id}`,
      selectedCellIds: pendingLayoutChange.assignedWidgets
        .map((entry) => entry.cellId)
        .filter((id) => selected.has(id)),
    });
  }

  function confirmPendingLayoutChange() {
    if (!pendingLayoutChange || !pendingPage) return;
    applyLayoutChange(
      pendingPage,
      pendingLayoutChange.nextLayout,
      new Set(pendingLayoutChange.selectedCellIds)
    );
    setPendingSelectionState(null);
    setProjectDialogParam(null);
  }

  return (
    <div className="overflow-x-hidden rounded-item border border-border bg-background p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <LayoutGrid className="icon-xs text-accent" />
        <span className="flex-1 font-mono text-muted-foreground text-w-sm uppercase tracking-wider">
          Dashboard Pages
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleAddPage}
          uppercase={false}
          className="h-auto px-2 py-1 font-mono text-dim text-w-sm hover:bg-transparent hover:text-muted-foreground"
        >
          <Plus className="icon-xs mr-1" />
          Add Page
        </Button>
      </div>

      <p className="mb-3 font-mono text-dim text-w-sm">
        Pages are scoped to {ownerName}. Each page keeps its own layout and widget placement.
      </p>

      <div className="space-y-2">
        {pages.map((page, index) => (
          <ProjectDashboardPageCard
            key={page.slug}
            detectedColumns={detectedColumns}
            groupedLayouts={groupedLayouts}
            handleMovePage={handleMovePage}
            handleRequestLayoutChange={handleRequestLayoutChange}
            handleUpdatePage={handleUpdatePage}
            index={index}
            ownerSlug={ownerSlug}
            page={page}
            pages={pages}
            recommendedLayouts={recommendedLayouts}
            removeProjectPage={removeProjectPage}
            setProjectDialogParam={setProjectDialogParam}
            sortedLayouts={sortedLayouts}
          />
        ))}
      </div>

      <ProjectDashboardPageDialogs
        addProjectPage={addProjectPage}
        duplicateSource={duplicateSource}
        layouts={layouts}
        ownerName={ownerName}
        ownerSlug={ownerSlug}
        pendingLayoutChange={pendingLayoutChange}
        placementLayout={placementLayout}
        placementPage={placementPage}
        placementTargetSlug={shouldResetProjectDialog ? null : placementTargetSlug}
        projectLayouts={projectLayouts}
        projects={projects}
        setPendingSelectionState={setPendingSelectionState}
        setProjectDialogParam={setProjectDialogParam}
        updateLayouts={updateLayouts}
        updateProjectLayout={updateProjectLayout}
        onConfirmPendingLayoutChange={confirmPendingLayoutChange}
        onTogglePendingWidget={togglePendingWidget}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab content components
// ---------------------------------------------------------------------------

function OverviewTabContent({
  projectSlug,
  dashboardPageCount,
  getContext,
  platformCount,
  updateContext,
}: {
  projectSlug: string;
  dashboardPageCount: number;
  getContext: (projectSlug: string) => ProjectContext;
  platformCount: number;
  updateContext: (projectSlug: string, ctx: ProjectContext) => void;
}) {
  const context = getContext(projectSlug);

  return (
    <>
      <div className="border-border border-b px-5 pt-4 pb-3">
        <div className="mb-3">
          <div className="mb-1 font-mono text-dim text-w-sm uppercase tracking-[0.22em]">
            Profile
          </div>
          <p className="max-w-[560px] text-muted-foreground text-w-sm leading-relaxed">
            Keep the current stage and core project signals visible before diving into goals,
            priorities, and notes.
          </p>
        </div>

        <div className="mb-4">
          <div className="mb-2 font-mono text-muted-foreground text-w-xs uppercase tracking-wider">
            Stage
          </div>
          <StagePicker
            stage={context.stage}
            onChange={(stage) => updateContext(projectSlug, { ...context, stage })}
          />
          <p className="mt-2 max-w-content-max text-dim text-w-sm leading-relaxed">
            Used by the assistant to calibrate advice and prioritization:
            <span className="text-muted-foreground"> idea/mvp = validate fast</span>,
            <span className="text-muted-foreground"> growth = double down</span>,
            <span className="text-muted-foreground"> mature = protect revenue</span>,
            <span className="text-muted-foreground"> sunset = extract learnings</span>.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {[
            { label: "Pages", value: dashboardPageCount },
            { label: "Platforms", value: platformCount },
            { label: "Goals", value: context.goals.length },
            { label: "Priorities", value: context.priorities.length },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-item border border-border bg-background p-3 py-2.5"
            >
              <div className="font-mono text-dim text-w-sm uppercase tracking-wider">
                {item.label}
              </div>
              <div className="mt-1 font-mono text-foreground-secondary text-w-lg">{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      <ContextEditor context={context} onChange={(ctx) => updateContext(projectSlug, ctx)} />
    </>
  );
}

function DashboardTabContent({ ownerSlug, ownerName }: { ownerSlug: string; ownerName: string }) {
  return (
    <div className="overflow-x-hidden px-5 py-4">
      <DashboardPagesSection ownerSlug={ownerSlug} ownerName={ownerName} />
    </div>
  );
}

function PlatformsTabContent({
  projectSlug,
  projectName,
  allProjects,
  allPlatforms,
  userPlatformIdSet,
  showAddPlatform,
  onShowAddPlatformChange,
  onAddPlatform,
  onDeletePlatform,
  onOpenIntegrationSettings,
  getIntegration,
  updateIntegration,
}: {
  projectSlug: string;
  projectName: string;
  allProjects: Project[];
  allPlatforms: Platform[];
  userPlatformIdSet: Set<string>;
  showAddPlatform: boolean;
  onShowAddPlatformChange: (show: boolean) => void;
  onAddPlatform: (name: string, type: PlatformType) => void;
  onDeletePlatform: (platformId: string) => void;
  onOpenIntegrationSettings?: (serviceId: string) => void;
  getIntegration: (projectSlug: string, platformId: string, key: string) => unknown;
  updateIntegration: (projectSlug: string, platformId: string, key: string, value: unknown) => void;
}) {
  return (
    <div className="overflow-x-hidden px-5 py-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex-1 font-mono text-muted-foreground text-w-xs uppercase tracking-wider">
          Platforms
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onShowAddPlatformChange(true)}
          uppercase={false}
          className="h-auto px-2 py-1 font-mono text-dim text-w-sm hover:bg-transparent hover:text-muted-foreground"
        >
          <Plus className="icon-xs mr-1" />
          Add Platform
        </Button>
      </div>

      <div className="space-y-1.5">
        {showAddPlatform ? (
          <AddPlatformForm
            key={`${projectSlug}:${projectName}`}
            suggestedName={projectName}
            onAdd={onAddPlatform}
            onCancel={() => onShowAddPlatformChange(false)}
          />
        ) : null}

        {allPlatforms.map((platform) => (
          <PlatformSection
            key={platform.id}
            platform={platform}
            projectSlug={projectSlug}
            allProjects={allProjects}
            isUserPlatform={userPlatformIdSet.has(platform.id)}
            onDeletePlatform={
              userPlatformIdSet.has(platform.id) ? () => onDeletePlatform(platform.id) : undefined
            }
            onOpenIntegrationSettings={onOpenIntegrationSettings}
            getIntegration={getIntegration}
            updateIntegration={updateIntegration}
          />
        ))}

        {allPlatforms.length === 0 && !showAddPlatform ? (
          <p className="font-mono text-dim text-w-sm">
            No platforms yet. Use "Add Platform" above.
          </p>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProjectDetailPanel
// ---------------------------------------------------------------------------

export function ProjectDetailPanel({
  project,
  allProjects,
  integrations,
  isUserCreated,
  onDeleteProject,
  onOpenIntegrationSettings,
  getIntegration,
  updateIntegration,
}: {
  project: Project;
  allProjects: Project[];
  integrations: ProjectIntegrationsMap;
  isUserCreated: boolean;
  onDeleteProject: () => void;
  onOpenIntegrationSettings?: (serviceId: string) => void;
  getIntegration: (projectSlug: string, platformId: string, key: string) => unknown;
  updateIntegration: (projectSlug: string, platformId: string, key: string, value: unknown) => void;
}) {
  const { projectLayouts } = useDashboard();
  const [showAddPlatform, setShowAddPlatform] = useState(false);
  const { getContext, updateContext } = useProjectContext();

  const nameOverride = getIntegration(project.slug, "_project", "name") as string | null;
  const descOverride = getIntegration(project.slug, "_project", "description") as string | null;
  const colorOverride = getIntegration(project.slug, "_project", "color") as string | null;

  const displayName = nameOverride ?? project.name;
  const displayDesc = descOverride ?? project.description ?? "";
  const displayColor = colorOverride ?? project.color;

  const addedPlatformIds = userPlatformIds(integrations, project.slug);
  const userPlatforms = addedPlatformIds.map((id) =>
    buildUserPlatform(integrations, project.slug, id)
  );
  const allPlatforms = [...project.platforms, ...userPlatforms];
  const userPlatformIdSet = new Set(addedPlatformIds);
  const dashboardPageCount = getProjectDashboardPages(projectLayouts, project.slug).length;
  const platformCount = allPlatforms.length;

  function handleAddPlatform(name: string, type: PlatformType) {
    const id = `${generateSlug(name)}-${Date.now()}`;
    const currentIds = userPlatformIds(integrations, project.slug);
    updateIntegration(project.slug, "@@platforms", "ids", [...currentIds, id]);
    updateIntegration(project.slug, `@@plat_${id}`, "name", name);
    updateIntegration(project.slug, `@@plat_${id}`, "type", type);
    setShowAddPlatform(false);
  }

  function handleDeletePlatform(platformId: string) {
    const currentIds = userPlatformIds(integrations, project.slug);
    updateIntegration(
      project.slug,
      "@@platforms",
      "ids",
      currentIds.filter((id) => id !== platformId)
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="border-border border-b px-5 pt-5 pb-4">
        <div className="mb-3 flex items-center gap-3">
          <label className="relative shrink-0 cursor-pointer">
            <span
              className="icon-sm block rounded-full ring-2 ring-transparent ring-offset-2 ring-offset-background transition-all hover:ring-accent"
              style={{ backgroundColor: displayColor }}
            />
            <input
              type="color"
              value={displayColor}
              onChange={(e) => updateIntegration(project.slug, "_project", "color", e.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label="Project color"
            />
          </label>

          <Input
            type="text"
            value={displayName}
            onChange={(e) => updateIntegration(project.slug, "_project", "name", e.target.value)}
            className="h-8 flex-1 rounded-none border-none bg-transparent p-0 font-medium font-mono text-foreground-secondary text-w-lg uppercase tracking-wider shadow-none focus-visible:border-accent focus-visible:border-b"
            aria-label="Project name"
          />

          {Boolean(isUserCreated) && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onDeleteProject}
              uppercase={false}
              className="h-7 w-7 text-dim transition-colors hover:text-destructive"
              aria-label="Delete project"
            >
              <Trash2 className="icon-xs" />
            </Button>
          )}
        </div>

        <Input
          type="text"
          value={displayDesc}
          onChange={(e) =>
            updateIntegration(project.slug, "_project", "description", e.target.value)
          }
          placeholder="Short project description…"
          className="h-9 w-full"
          aria-label="Project description"
        />
      </div>

      <ProjectSettingsTabs
        dashboardPageCount={dashboardPageCount}
        platformCount={platformCount}
        overviewContent={
          <OverviewTabContent
            projectSlug={project.slug}
            dashboardPageCount={dashboardPageCount}
            getContext={getContext}
            platformCount={platformCount}
            updateContext={updateContext}
          />
        }
        dashboardContent={<DashboardTabContent ownerSlug={project.slug} ownerName={displayName} />}
        platformsContent={
          <PlatformsTabContent
            projectSlug={project.slug}
            projectName={displayName}
            allProjects={allProjects}
            allPlatforms={allPlatforms}
            userPlatformIdSet={userPlatformIdSet}
            showAddPlatform={showAddPlatform}
            onShowAddPlatformChange={setShowAddPlatform}
            onAddPlatform={handleAddPlatform}
            onDeletePlatform={handleDeletePlatform}
            onOpenIntegrationSettings={onOpenIntegrationSettings}
            getIntegration={getIntegration}
            updateIntegration={updateIntegration}
          />
        }
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// AllProjectPanel
// ---------------------------------------------------------------------------

export function AllProjectPanel() {
  return (
    <div className="scrollbar-thin flex h-full flex-col overflow-y-auto overflow-x-hidden">
      <div className="border-border border-b px-5 pt-5 pb-4">
        <div className="mb-2 flex items-center gap-3">
          <LayoutGrid className="icon-sm shrink-0 text-accent" />
          <span className="font-medium font-mono text-foreground text-w-lg uppercase tracking-wider">
            All Projects
          </span>
        </div>
        <p className="font-mono text-muted-foreground text-w-sm leading-relaxed">
          Aggregate dashboard view across every project. Layout and widget placement configured here
          only affect the All Projects tab.
        </p>
      </div>

      <div className="px-5 py-4">
        <DashboardPagesSection ownerSlug={ALL_PROJECTS_SLUG} ownerName="All Projects" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DeleteProjectDialog
// ---------------------------------------------------------------------------

export function DeleteProjectDialog({
  pendingDeleteProject,
  pendingDeleteProjectName,
  onClose,
  onDelete,
}: {
  pendingDeleteProject: Project | null;
  pendingDeleteProjectName: string | null;
  onClose: () => void;
  onDelete: () => void;
}) {
  return (
    <ConfirmationDialog
      open={pendingDeleteProject !== null}
      onOpenChange={(open) => !open && onClose()}
      title="Delete Project"
      confirmLabel="Delete project"
      onConfirm={onDelete}
      successToast={
        pendingDeleteProjectName ? `Deleted ${pendingDeleteProjectName}` : "Project deleted"
      }
      errorToast="Failed to delete project"
    >
      <DialogDescription>
        {pendingDeleteProjectName ? (
          <>
            Delete <span className="text-foreground">{pendingDeleteProjectName}</span>? This removes
            the project from your dashboard list.
          </>
        ) : null}
      </DialogDescription>
    </ConfirmationDialog>
  );
}
