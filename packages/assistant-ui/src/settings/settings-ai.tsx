"use client";

import {
  readEnabledModels,
  writeEnabledModels,
} from "@radarboard/assistant-core/model-preferences";
import { useCredentials } from "@radarboard/hooks/use-credentials";
import { listProviders } from "@radarboard/llm/providers/registry";
import { listBuiltinSkills } from "@radarboard/llm/skills/registry";
import { SKILL_TEMPLATES } from "@radarboard/llm/skills/templates";
import type {
  LlmCredentialField,
  LlmProviderDescriptor,
  LlmSkillDescriptor,
} from "@radarboard/llm/types";
import {
  API_ROUTES,
  providerOAuthAuthorizeRoute,
  providerOAuthRevokeRoute,
} from "@radarboard/types/api-routes";
import type { AssistantMode, AssistantPresetConfig, LlmSkillRow } from "@radarboard/types/database";
import { VIEW_STATE_QUERY_KEYS } from "@radarboard/types/view-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@radarboard/ui/app-dialog";
import { Badge } from "@radarboard/ui/badge";
import { Button } from "@radarboard/ui/button";
import { Input } from "@radarboard/ui/input";
import { Label } from "@radarboard/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@radarboard/ui/select";
import { Switch } from "@radarboard/ui/switch";
import { Textarea } from "@radarboard/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@radarboard/ui/tooltip";
import { cn } from "@radarboard/utils/cn";
import {
  BookOpenIcon,
  BotIcon,
  BrainIcon,
  CheckCircle2Icon,
  DownloadCloudIcon,
  KeyIcon,
  Loader2,
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
  ServerIcon,
  SlidersIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import useSWR from "swr";

type ProviderAuthMethod = {
  type: "api" | "oauth";
  label: string;
};

type AiSection = "providers" | "skills" | "presets" | "prompts" | "memory";

async function fetchProviderAuthMethods(
  url: string
): Promise<Record<string, ProviderAuthMethod[]>> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load provider auth methods: ${response.status}`);
  }
  return (await response.json()) as Record<string, ProviderAuthMethod[]>;
}

const AI_SECTIONS: { id: AiSection; label: string; icon: typeof BotIcon }[] = [
  { id: "providers", label: "Providers", icon: ServerIcon },
  { id: "skills", label: "Skills", icon: BrainIcon },
  { id: "presets", label: "Presets", icon: SparklesIcon },
  { id: "prompts", label: "Prompts", icon: SlidersIcon },
  { id: "memory", label: "Memory", icon: BookOpenIcon },
];

const AI_SECTION_IDS = ["providers", "skills", "presets", "prompts", "memory"] as const;
const MODEL_STORAGE_KEY = "radarboard:chat-model";
const EMPTY_DISABLED_SECTIONS: AiSection[] = [];

/** Breakpoint below which the section tabs collapse to icons only. */
const AI_COLLAPSE_BREAKPOINT = 900;

export function SettingsAi({
  listWidthClassName = "w-[260px]",
  disabledSections = EMPTY_DISABLED_SECTIONS,
}: {
  listWidthClassName?: string;
  /** Sections to hide (e.g. when a feature flag is off). */
  disabledSections?: AiSection[];
}) {
  const visibleSections =
    disabledSections.length > 0
      ? AI_SECTIONS.filter((s) => !disabledSections.includes(s.id))
      : AI_SECTIONS;
  const _visibleIds = visibleSections.map((s) => s.id);

  const [activeSection, setActiveSection] = useQueryState(
    "ai",
    parseAsStringLiteral(AI_SECTION_IDS).withDefault("providers")
  );
  const [oauthSuccess, setOauthSuccess] = useQueryState("oauth_success", parseAsString);
  const [oauthError, setOauthError] = useQueryState("oauth_error", parseAsString);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${AI_COLLAPSE_BREAKPOINT}px)`);
    const onChange = (e: MediaQueryListEvent | MediaQueryList) => setCollapsed(e.matches);
    onChange(mq);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      <div
        className={cn(
          collapsed ? "w-[48px]" : listWidthClassName,
          "flex shrink-0 flex-col overflow-hidden border-border border-r transition-[width] duration-200"
        )}
      >
        {!collapsed && (
          <div className="shrink-0 border-border border-b p-3">
            <div className="font-mono text-dim text-xs uppercase tracking-widest">Assistant</div>
            <div className="text-dim/70 text-xs">Providers, models &amp; skills</div>
          </div>
        )}
        <div className="scrollbar-thin flex-1 overflow-y-auto">
          {visibleSections.map((section) => (
            <Tooltip key={section.id}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "uppercase-none flex h-auto w-full items-center rounded-none text-left font-sans transition-colors",
                    collapsed ? "justify-center px-2 py-3" : "justify-start gap-2.5 px-4 py-3",
                    activeSection === section.id
                      ? "bg-secondary text-foreground"
                      : "text-dim hover:bg-muted hover:text-foreground-secondary"
                  )}
                >
                  <section.icon size={14} className="shrink-0" />
                  {!collapsed && <span className="font-mono text-w-base">{section.label}</span>}
                </Button>
              </TooltipTrigger>
              {collapsed && <TooltipContent side="right">{section.label}</TooltipContent>}
            </Tooltip>
          ))}
        </div>
      </div>

      <div className="scrollbar-thin flex-1 overflow-y-auto">
        {Boolean(oauthSuccess || oauthError) && (
          <div className="p-4 pb-0">
            {Boolean(oauthSuccess) && (
              <div className="flex items-center justify-between rounded-card border border-success/20 bg-success/5 px-3 py-2 font-mono text-success text-w-sm">
                <span>Connected {oauthSuccess} successfully via OAuth.</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setOauthSuccess(null)}
                  className="uppercase-none h-auto p-0 text-success underline hover:bg-transparent hover:no-underline"
                >
                  Dismiss
                </Button>
              </div>
            )}
            {Boolean(oauthError) && (
              <div className="flex items-center justify-between rounded-card border border-destructive/20 bg-destructive/5 px-3 py-2 font-mono text-destructive text-w-sm">
                <span>{oauthError}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setOauthError(null)}
                  className="uppercase-none h-auto p-0 text-destructive underline hover:bg-transparent hover:no-underline"
                >
                  Dismiss
                </Button>
              </div>
            )}
          </div>
        )}
        {activeSection === "providers" && <ProvidersPanel />}
        {activeSection === "skills" && <SkillsPanel />}
        {activeSection === "presets" && <PresetsPanel />}
        {activeSection === "prompts" && <PromptsPanel />}
        {activeSection === "memory" && <MemoryPanel />}
      </div>
    </div>
  );
}

function DefaultModelPicker({ connectedKeys }: { connectedKeys: string[] }) {
  const providers = listProviders();
  const [value, setValue] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(MODEL_STORAGE_KEY) ?? "";
  });

  const connectedProviders = providers.filter((p) => connectedKeys.includes(p.credentialKeyPrefix));

  const handleChange = (newValue: string) => {
    setValue(newValue);
    if (newValue) {
      localStorage.setItem(MODEL_STORAGE_KEY, newValue);
    } else {
      localStorage.removeItem(MODEL_STORAGE_KEY);
    }
  };

  if (connectedProviders.length === 0) return null;

  const enabledModels = readEnabledModels() ?? {};

  return (
    <div className="mb-6 rounded-card border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-bold font-mono text-foreground text-w-base">Default model</p>
          <p className="mt-0.5 font-mono text-dim text-w-sm">
            Pre-selects this model in the chat composer.
          </p>
        </div>
        <Select value={value} onValueChange={handleChange}>
          <SelectTrigger className="h-9 min-w-[180px]">
            <SelectValue placeholder="— none —" />
          </SelectTrigger>
          <SelectContent>
            {connectedProviders.map((provider) => {
              const enabled = enabledModels[provider.id];
              const models =
                enabled === null || enabled === undefined
                  ? provider.models
                  : provider.models.filter((m) => enabled.includes(m.id));
              if (models.length === 0) return null;
              return (
                <SelectGroup key={provider.id}>
                  <SelectGroupLabel>{provider.name}</SelectGroupLabel>
                  {models.map((m) => (
                    <SelectItem key={m.id} value={`${provider.id}:${m.id}`}>
                      {m.name ?? m.id}
                    </SelectItem>
                  ))}
                </SelectGroup>
              );
            })}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function ProvidersPanel() {
  const providers = listProviders();
  const { connectedKeys, refetch } = useCredentials();
  const { data: authMethods = {} } = useSWR<Record<string, ProviderAuthMethod[]>>(
    API_ROUTES.providerAuthMethods,
    fetchProviderAuthMethods,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }
  );

  return (
    <div className="p-6">
      <h2 className="mb-1 font-bold font-mono text-foreground text-w-lg">Model Providers</h2>
      <p className="mb-4 font-mono text-dim text-w-sm">
        Connect providers and choose which models to enable. Only enabled models appear in the chat
        selector.
      </p>
      <DefaultModelPicker connectedKeys={connectedKeys} />
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {providers.map((provider) => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            isConnected={connectedKeys.includes(provider.credentialKeyPrefix)}
            methods={authMethods[provider.id] ?? [{ type: "api", label: "API key" }]}
            onRefresh={refetch}
          />
        ))}
      </div>
    </div>
  );
}

function useProviderCardHandlers({
  credKey,
  provider,
  methods,
  fieldValues,
  setIsEditing,
  setIsSaving,
  setIsDisconnecting,
  onRefresh,
}: {
  credKey: string;
  provider: LlmProviderDescriptor;
  methods: ProviderAuthMethod[];
  fieldValues: Record<string, string>;
  setIsEditing: (v: boolean) => void;
  setIsSaving: (v: boolean) => void;
  setIsDisconnecting: (v: boolean) => void;
  onRefresh: () => void;
}) {
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await fetch(API_ROUTES.credentials, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: credKey, values: fieldValues }),
      });
      setIsEditing(false);
      onRefresh();
    } finally {
      setIsSaving(false);
    }
  }, [credKey, fieldValues, onRefresh, setIsEditing, setIsSaving]);

  const handleDisconnect = useCallback(async () => {
    setIsDisconnecting(true);
    try {
      const isOAuth = methods.some((m) => m.type === "oauth");
      if (isOAuth) {
        await fetch(providerOAuthRevokeRoute(provider.id), { method: "POST" });
      } else {
        await fetch(API_ROUTES.credentials, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: credKey }),
        });
      }
      setIsEditing(false);
      onRefresh();
    } finally {
      setIsDisconnecting(false);
    }
  }, [credKey, methods, onRefresh, provider.id, setIsDisconnecting, setIsEditing]);

  const handleOAuthConnect = useCallback(async () => {
    const res = await fetch(providerOAuthAuthorizeRoute(provider.id), {
      method: "POST",
    });
    const data = (await res.json()) as { url?: string; error?: string };
    if (res.ok && data.url) {
      window.location.href = data.url;
      return;
    }
    const msg = data.error ?? "OAuth authorization failed";
    const params = new URLSearchParams(window.location.search);
    params.set("settings", "ai");
    params.set("oauth_error", msg);
    window.history.replaceState(null, "", `/?${params.toString()}`);
    window.location.reload();
  }, [provider.id]);

  return { handleSave, handleDisconnect, handleOAuthConnect };
}

function ProviderCard({
  provider,
  isConnected,
  methods,
  onRefresh,
}: {
  provider: LlmProviderDescriptor;
  isConnected: boolean;
  methods: ProviderAuthMethod[];
  onRefresh: () => void;
}) {
  const credKey = provider.credentialKeyPrefix;
  const [isEditing, setIsEditing] = useState(false);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const beginEdit = useCallback(() => {
    const initial: Record<string, string> = {};
    for (const field of provider.credentialFields) {
      initial[field.key] = "";
    }
    setFieldValues(initial);
    setIsEditing(true);
  }, [provider.credentialFields]);

  const { handleSave, handleDisconnect, handleOAuthConnect } = useProviderCardHandlers({
    credKey,
    provider,
    methods,
    fieldValues,
    setIsEditing,
    setIsSaving,
    setIsDisconnecting,
    onRefresh,
  });

  const allFieldsFilled = provider.credentialFields
    .filter((f) => f.required)
    .every((f) => fieldValues[f.key]?.trim());

  const hasOAuth = methods.some((m) => m.type === "oauth");
  const getKeyButtonVariant = () => {
    if (isConnected) return "outline";
    if (hasOAuth) return "ghost";
    return "default";
  };
  const keyButtonVariant = getKeyButtonVariant();
  const getKeyButtonLabel = () => {
    if (isConnected) return "Update key";
    if (hasOAuth) return "Use API key instead";
    return "Connect";
  };
  const keyButtonLabel = getKeyButtonLabel();
  const showModelToggles = isConnected && !isEditing;

  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
      <ProviderCardHeader provider={provider} isConnected={isConnected} isEditing={isEditing} />

      {!isConnected && !hasOAuth && (
        <p className="font-mono text-dim text-w-sm">
          This provider currently uses API key authentication only.
        </p>
      )}

      {Boolean(isEditing) && (
        <ProviderCardEditForm
          provider={provider}
          fieldValues={fieldValues}
          setFieldValues={setFieldValues}
          allFieldsFilled={allFieldsFilled}
          isSaving={isSaving}
          onSave={handleSave}
          onCancel={() => setIsEditing(false)}
        />
      )}

      {!isEditing && (
        <ProviderCardActions
          provider={provider}
          isConnected={isConnected}
          hasOAuth={hasOAuth}
          keyButtonVariant={keyButtonVariant}
          keyButtonLabel={keyButtonLabel}
          isDisconnecting={isDisconnecting}
          onEdit={beginEdit}
          onOAuthConnect={handleOAuthConnect}
          onDisconnect={handleDisconnect}
        />
      )}

      {Boolean(showModelToggles) && <ModelToggles provider={provider} />}
    </div>
  );
}

function ProviderCardHeader({
  provider,
  isConnected,
  isEditing,
}: {
  provider: LlmProviderDescriptor;
  isConnected: boolean;
  isEditing: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <BotIcon size={14} className="text-dim" />
        <span className="font-bold font-mono text-foreground text-w-base">{provider.name}</span>
      </div>
      {isConnected && !isEditing && (
        <span className="flex items-center gap-1 font-mono text-success text-w-sm">
          <CheckCircle2Icon size={10} />
          Connected
        </span>
      )}
    </div>
  );
}

function ProviderCardEditForm({
  provider,
  fieldValues,
  setFieldValues,
  allFieldsFilled,
  isSaving,
  onSave,
  onCancel,
}: {
  provider: LlmProviderDescriptor;
  fieldValues: Record<string, string>;
  setFieldValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  allFieldsFilled: boolean;
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {provider.credentialFields.map((field) => (
        <CredentialInput
          key={field.key}
          field={field}
          value={fieldValues[field.key] ?? ""}
          onChange={(v) => setFieldValues((prev) => ({ ...prev, [field.key]: v }))}
        />
      ))}
      <div className="mt-1 flex gap-2">
        <Button
          size="sm"
          onClick={onSave}
          disabled={!allFieldsFilled || isSaving}
          className="uppercase-none"
        >
          {isSaving ? <Loader2 size={12} className="mr-1.5 animate-spin" /> : null}
          Save
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel} className="uppercase-none">
          Cancel
        </Button>
      </div>
    </div>
  );
}

function ProviderCardActions({
  provider,
  isConnected,
  hasOAuth,
  keyButtonVariant,
  keyButtonLabel,
  isDisconnecting,
  onEdit,
  onOAuthConnect,
  onDisconnect,
}: {
  provider: LlmProviderDescriptor;
  isConnected: boolean;
  hasOAuth: boolean;
  keyButtonVariant: "outline" | "ghost" | "default";
  keyButtonLabel: string;
  isDisconnecting: boolean;
  onEdit: () => void;
  onOAuthConnect: () => void;
  onDisconnect: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {!isConnected && hasOAuth && (
        <Button size="sm" onClick={onOAuthConnect} uppercase={false}>
          Connect with {provider.name}
        </Button>
      )}
      <Button variant={keyButtonVariant} size="sm" onClick={onEdit} className="uppercase-none">
        <KeyIcon size={11} className="mr-1" />
        {keyButtonLabel}
      </Button>
      {Boolean(isConnected) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onDisconnect}
          disabled={isDisconnecting}
          className="uppercase-none text-destructive/80 hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2Icon size={11} className="mr-1" />
          {isDisconnecting ? "Disconnecting..." : "Disconnect"}
        </Button>
      )}
    </div>
  );
}

function CredentialInput({
  field,
  value,
  onChange,
}: {
  field: LlmCredentialField;
  value: string;
  onChange: (v: string) => void;
}) {
  const inputId = `llm-cred-${field.key}`;
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={inputId}>
        {field.label}
        {Boolean(field.required) && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      <Input
        id={inputId}
        type={field.type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        className="h-9"
      />
    </div>
  );
}

function ModelToggles({ provider }: { provider: LlmProviderDescriptor }) {
  const [enabledMap, setEnabledMap] = useState<Record<string, string[]>>(
    () => readEnabledModels() ?? {}
  );
  const enabledForProvider = enabledMap[provider.id] ?? null;

  const isModelEnabled = (modelId: string) => {
    if (!enabledForProvider) return true;
    return enabledForProvider.includes(modelId);
  };

  const toggleModel = (modelId: string) => {
    const current = enabledForProvider ?? provider.models.map((m) => m.id);
    const next = current.includes(modelId)
      ? current.filter((id) => id !== modelId)
      : [...current, modelId];
    if (next.length === 0) return;
    const nextMap = { ...enabledMap, [provider.id]: next };
    setEnabledMap(nextMap);
    writeEnabledModels(nextMap);
  };

  const enabledCount = enabledForProvider ? enabledForProvider.length : provider.models.length;

  return (
    <div className="mt-1 border-border border-t pt-2">
      <p className="mb-2 font-mono text-dim text-w-sm uppercase tracking-widest">
        Models ({enabledCount}/{provider.models.length})
      </p>
      <div className="space-y-1">
        {provider.models.map((model) => (
          <div key={model.id} className="flex items-center justify-between py-0.5">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate font-mono text-foreground text-w-sm">{model.name}</span>
              {model.id === provider.defaultModel && (
                <span className="shrink-0 rounded-item bg-accent/10 px-1 py-0.5 font-mono text-accent text-w-sm">
                  default
                </span>
              )}
            </div>
            <Switch
              checked={isModelEnabled(model.id)}
              onCheckedChange={() => toggleModel(model.id)}
              aria-label={`${isModelEnabled(model.id) ? "Disable" : "Enable"} ${model.name}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

interface LlmConfigState {
  identityPrompt?: string;
  extractionPrompt?: string;
  skillOverrides?: Record<string, string>;
  assistantPresets?: AssistantPresetConfig[];
}

async function fetchLlmConfig(): Promise<LlmConfigState> {
  const res = await fetch(API_ROUTES.settings);
  if (!res.ok) return {};
  const data = (await res.json()) as { llmConfig?: LlmConfigState };
  return data.llmConfig ?? {};
}

async function saveLlmConfig(patch: Partial<LlmConfigState>): Promise<void> {
  const current = await fetchLlmConfig();
  await fetch(API_ROUTES.settings, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ llmConfig: { ...current, ...patch } }),
  });
}

function SkillsPanel() {
  const builtinSkills = listBuiltinSkills();
  const [customSkills, setCustomSkills] = useState<LlmSkillRow[]>([]);
  const [skillOverrides, setSkillOverrides] = useState<Record<string, string>>({});
  const [skillEditorParam, setSkillEditorParam] = useQueryState(
    VIEW_STATE_QUERY_KEYS.aiSkillEditor,
    parseAsString
  );
  const [newSkillDraft, setNewSkillDraft] = useState({
    name: "",
    description: "",
    instructions: "",
  });
  const [addSaving, setAddSaving] = useState(false);

  const loadSkills = useCallback(() => {
    fetch(API_ROUTES.chatSkills)
      .then((res) => res.json())
      .then((data: LlmSkillRow[]) => {
        if (Array.isArray(data)) setCustomSkills(data);
      })
      .catch(() => {
        // ignore load errors
      });
  }, []);

  useEffect(() => {
    loadSkills();
    fetchLlmConfig()
      .then((cfg) => {
        if (cfg.skillOverrides) setSkillOverrides(cfg.skillOverrides);
      })
      .catch(() => {
        // ignore load errors
      });
  }, [loadSkills]);

  const handleSaveOverride = async (skillId: string, instructions: string) => {
    const next = { ...skillOverrides, [skillId]: instructions };
    setSkillOverrides(next);
    await saveLlmConfig({ skillOverrides: next });
  };

  const handleResetOverride = async (skillId: string) => {
    const next = { ...skillOverrides };
    delete next[skillId];
    setSkillOverrides(next);
    await saveLlmConfig({ skillOverrides: next });
  };

  const handleCreate = async () => {
    if (!newSkillDraft.name.trim()) return;
    setAddSaving(true);
    await fetch(API_ROUTES.chatSkills, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newSkillDraft.name,
        description: newSkillDraft.description,
        instructions: newSkillDraft.instructions,
      }),
    });
    setNewSkillDraft({ name: "", description: "", instructions: "" });
    setAddSaving(false);
    setSkillEditorParam(null);
    loadSkills();
  };

  const handleDelete = async (id: string) => {
    await fetch(API_ROUTES.chatSkills, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    loadSkills();
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    // Optimistic update
    setCustomSkills((prev) => prev.map((s) => (s.id === id ? { ...s, enabled } : s)));
    const skill = customSkills.find((s) => s.id === id);
    if (!skill) return;
    await fetch(API_ROUTES.chatSkills, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: skill.id,
        name: skill.name,
        description: skill.description,
        instructions: skill.instructions,
        enabled,
      }),
    });
  };

  const handleUpdate = async (id: string, instructions: string, description: string) => {
    const skill = customSkills.find((s) => s.id === id);
    if (!skill) return;
    await fetch(API_ROUTES.chatSkills, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: skill.id,
        name: skill.name,
        description,
        instructions,
        enabled: skill.enabled,
      }),
    });
    loadSkills();
  };

  return (
    <div className="p-6">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="font-bold font-mono text-foreground text-w-lg">Skills</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setNewSkillDraft({ name: "", description: "", instructions: "" });
            setSkillEditorParam("new");
          }}
          className="uppercase-none"
        >
          <PlusIcon size={12} className="mr-1" /> Add skill
        </Button>
      </div>
      <p className="mb-4 font-mono text-dim text-w-sm">
        Instructions injected into the AI system prompt. Built-in skills can be overridden — the AI
        can also update them mid-conversation.
      </p>

      <SkillImportSection onInstalled={loadSkills} />

      <hr className="mb-6 border-border/50" />

      {customSkills.length > 0 && (
        <div className="mb-6 space-y-2">
          <p className="font-mono text-dim text-w-sm uppercase tracking-widest">Custom</p>
          {customSkills.map((skill) => (
            <CustomSkillCard
              key={skill.id}
              skill={skill}
              open={skillEditorParam === `custom:${skill.id}`}
              onOpenChange={(open) => setSkillEditorParam(open ? `custom:${skill.id}` : null)}
              onDelete={() => handleDelete(skill.id)}
              onToggle={(enabled) => handleToggle(skill.id, enabled)}
              onUpdate={(instructions, description) =>
                handleUpdate(skill.id, instructions, description)
              }
            />
          ))}
        </div>
      )}

      <SkillTemplatesSection onInstalled={loadSkills} />

      <div className="mb-6 space-y-2">
        <p className="font-mono text-dim text-w-sm uppercase tracking-widest">Built-in</p>
        {builtinSkills.map((skill) => (
          <BuiltinSkillCard
            key={skill.id}
            skill={skill}
            open={skillEditorParam === `builtin:${skill.id}`}
            onOpenChange={(open) => setSkillEditorParam(open ? `builtin:${skill.id}` : null)}
            override={skillOverrides[skill.id]}
            onSave={(instructions) => handleSaveOverride(skill.id, instructions)}
            onReset={() => handleResetOverride(skill.id)}
          />
        ))}
      </div>

      <SkillEditorDialog
        open={skillEditorParam === "new"}
        onOpenChange={(open) => setSkillEditorParam(open ? "new" : null)}
        title="New Skill"
        nameEditable
        nameValue={newSkillDraft.name}
        onNameChange={(name) => setNewSkillDraft((current) => ({ ...current, name }))}
        descriptionEditable
        draftDescription={newSkillDraft.description}
        onDescriptionChange={(description) =>
          setNewSkillDraft((current) => ({ ...current, description }))
        }
        instructions={newSkillDraft.instructions}
        onInstructionsChange={(instructions) =>
          setNewSkillDraft((current) => ({ ...current, instructions }))
        }
        saving={addSaving}
        onSave={handleCreate}
      />
    </div>
  );
}

function SkillEditorDialog({
  open,
  onOpenChange,
  title,
  description,
  nameEditable,
  nameValue,
  onNameChange,
  descriptionEditable,
  draftDescription,
  onDescriptionChange,
  instructions,
  onInstructionsChange,
  saving,
  onSave,
  onReset,
  isOverridden,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  nameEditable?: boolean;
  nameValue?: string;
  onNameChange?: (v: string) => void;
  descriptionEditable?: boolean;
  draftDescription?: string;
  onDescriptionChange?: (v: string) => void;
  instructions: string;
  onInstructionsChange: (v: string) => void;
  saving: boolean;
  onSave: () => void;
  onReset?: () => void;
  isOverridden?: boolean;
}) {
  const nameInputRef = useRef<HTMLInputElement>(null);
  const saveDisabled = saving || !instructions.trim() || (nameEditable && !nameValue?.trim());

  useEffect(() => {
    if (open && nameEditable) {
      nameInputRef.current?.focus();
    }
  }, [nameEditable, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" className="flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && !descriptionEditable && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>
        <div className="flex flex-1 flex-col gap-3 overflow-hidden p-4">
          {nameEditable && (
            <div className="space-y-1">
              <Label htmlFor="editor-name">Name</Label>
              <Input
                ref={nameInputRef}
                id="editor-name"
                type="text"
                value={nameValue ?? ""}
                onChange={(e) => onNameChange?.(e.target.value)}
                placeholder="Skill name..."
                className="h-9"
              />
            </div>
          )}
          {descriptionEditable && (
            <div className="space-y-1">
              <Label htmlFor="editor-desc">Description</Label>
              <Input
                id="editor-desc"
                type="text"
                value={draftDescription ?? ""}
                onChange={(e) => onDescriptionChange?.(e.target.value)}
                placeholder="Short description..."
                className="h-9"
              />
            </div>
          )}
          <div className="flex flex-1 flex-col space-y-1 overflow-hidden">
            <Label htmlFor="editor-inst">Instructions</Label>
            <Textarea
              id="editor-inst"
              value={instructions}
              onChange={(e) => onInstructionsChange(e.target.value)}
              className="flex-1 resize-none bg-background font-mono text-w-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={onSave} disabled={saveDisabled} className="uppercase-none">
              {saving ? <Loader2 size={12} className="mr-1.5 animate-spin" /> : null}
              Save
            </Button>
            {onReset && isOverridden && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onReset}
                className="uppercase-none text-warning"
              >
                <RotateCcwIcon size={11} className="mr-1" />
                Reset to default
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="uppercase-none"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BuiltinSkillCard({
  skill,
  open,
  onOpenChange,
  override,
  onSave,
  onReset,
}: {
  skill: LlmSkillDescriptor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  override: string | undefined;
  onSave: (instructions: string) => Promise<void>;
  onReset: () => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const isOverridden = override !== undefined;

  useEffect(() => {
    if (!open) return;
    setDraft(override ?? skill.instructions);
  }, [open, override, skill.instructions]);

  const handleSave = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    await onSave(draft.trim());
    setSaving(false);
    onOpenChange(false);
  };

  const handleReset = async () => {
    await onReset();
    onOpenChange(false);
  };

  return (
    <>
      <div
        className={cn(
          "rounded-card border bg-surface px-3 py-2",
          isOverridden ? "border-accent/30 bg-accent/5" : "border-border"
        )}
      >
        <div className="flex items-center gap-2">
          <BookOpenIcon size={12} className="shrink-0 text-dim" />
          <span className="flex-1 font-mono text-foreground text-w-base">{skill.name}</span>
          {isOverridden && (
            <span className="rounded-item bg-accent/15 px-1.5 py-0.5 font-mono text-accent text-w-sm">
              overridden
            </span>
          )}
          <span className="rounded-item bg-secondary px-1.5 py-0.5 font-mono text-dim text-w-sm">
            built-in
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(true)}
            className="icon-lg uppercase-none text-dim transition-colors hover:bg-transparent hover:text-foreground"
            aria-label={`Edit ${skill.name}`}
          >
            <PencilIcon size={11} />
          </Button>
        </div>
        {Boolean(skill.description) && (
          <p className="mt-0.5 ml-5 font-mono text-dim text-w-sm">{skill.description}</p>
        )}
      </div>
      <SkillEditorDialog
        open={open}
        onOpenChange={onOpenChange}
        title={skill.name}
        description={skill.description}
        instructions={draft}
        onInstructionsChange={setDraft}
        saving={saving}
        onSave={handleSave}
        onReset={handleReset}
        isOverridden={isOverridden}
      />
    </>
  );
}

function CustomSkillCard({
  skill,
  open,
  onOpenChange,
  onDelete,
  onToggle,
  onUpdate,
}: {
  skill: LlmSkillRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
  onToggle: (enabled: boolean) => void;
  onUpdate: (instructions: string, description: string) => void;
}) {
  const [draftInstructions, setDraftInstructions] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraftInstructions(skill.instructions);
    setDraftDescription(skill.description);
  }, [open, skill.description, skill.instructions]);

  const handleSave = async () => {
    setSaving(true);
    onUpdate(draftInstructions.trim(), draftDescription.trim());
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <>
      <div
        className={cn(
          "rounded-card border bg-surface px-3 py-2",
          skill.enabled ? "border-border" : "border-border/50 opacity-60"
        )}
      >
        <div className="flex items-center gap-2">
          <BookOpenIcon size={12} className="shrink-0 text-dim" />
          <span className="flex-1 font-mono text-foreground text-w-base">{skill.name}</span>
          <Switch
            checked={skill.enabled}
            onCheckedChange={onToggle}
            aria-label={`${skill.enabled ? "Disable" : "Enable"} ${skill.name}`}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(true)}
            className="icon-lg uppercase-none text-dim transition-colors hover:bg-transparent hover:text-foreground"
            aria-label={`Edit ${skill.name}`}
          >
            <PencilIcon size={11} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="icon-lg uppercase-none text-dim transition-colors hover:bg-transparent hover:text-destructive"
            aria-label={`Delete ${skill.name}`}
          >
            <Trash2Icon size={11} />
          </Button>
        </div>
        {Boolean(skill.description) && (
          <p className="mt-0.5 ml-5 font-mono text-dim text-w-sm">{skill.description}</p>
        )}
      </div>
      <SkillEditorDialog
        open={open}
        onOpenChange={onOpenChange}
        title={skill.name}
        description={skill.description}
        descriptionEditable
        draftDescription={draftDescription}
        onDescriptionChange={setDraftDescription}
        instructions={draftInstructions}
        onInstructionsChange={setDraftInstructions}
        saving={saving}
        onSave={handleSave}
      />
    </>
  );
}

function SkillTemplatesSection({ onInstalled }: { onInstalled: () => void }) {
  const [installing, setInstalling] = useState<string | null>(null);
  const [installed, setInstalled] = useState<Set<string>>(new Set());

  const handleInstall = async (template: (typeof SKILL_TEMPLATES)[number]) => {
    setInstalling(template.id);
    try {
      const res = await fetch(API_ROUTES.chatSkills, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: template.name,
          description: template.description,
          instructions: template.instructions,
        }),
      });
      if (res.ok) {
        setInstalled((prev) => new Set(prev).add(template.id));
        onInstalled();
      }
    } catch {
      // ignore
    } finally {
      setInstalling(null);
    }
  };

  return (
    <div className="mb-6 space-y-2">
      <p className="font-mono text-dim text-w-sm uppercase tracking-widest">Templates</p>
      <div className="space-y-1.5">
        {SKILL_TEMPLATES.map((template) => (
          <div
            key={template.id}
            className="flex items-center gap-3 rounded-card border border-border bg-surface px-3 py-2"
            title={template.description}
          >
            <DownloadCloudIcon size={12} className="shrink-0 text-dim" />
            <span className="shrink-0 font-mono text-foreground text-w-base">{template.name}</span>
            <span className="min-w-0 flex-1 truncate font-mono text-dim text-w-xs">
              {template.description}
            </span>
            <Button
              variant={installed.has(template.id) ? "ghost" : "outline"}
              size="sm"
              onClick={() => handleInstall(template)}
              disabled={installing === template.id || installed.has(template.id)}
              className="uppercase-none shrink-0"
            >
              {installed.has(template.id) ? (
                <>
                  <CheckCircle2Icon size={12} className="mr-1" /> Installed
                </>
              ) : installing === template.id ? (
                <>
                  <Loader2 size={12} className="mr-1 animate-spin" /> Installing
                </>
              ) : (
                "Install"
              )}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function PresetsPanel() {
  const [presets, setPresets] = useState<AssistantPresetConfig[]>([]);
  const [presetDraft, setPresetDraft] = useState({
    isAdding: false,
    editingId: null as string | null,
    name: "",
    description: "",
    prompt: "",
    mode: "default" as AssistantMode,
    modelId: "",
  });

  const loadPresets = useCallback(() => {
    fetch(API_ROUTES.chatPresets)
      .then((res) => res.json())
      .then((data: AssistantPresetConfig[]) => {
        if (Array.isArray(data)) setPresets(data);
      })
      .catch(() => {
        // ignore load errors
      });
  }, []);

  useEffect(() => {
    loadPresets();
  }, [loadPresets]);

  const resetDraft = () => {
    setPresetDraft({
      isAdding: false,
      editingId: null,
      name: "",
      description: "",
      prompt: "",
      mode: "default",
      modelId: "",
    });
  };

  const startEdit = (preset: AssistantPresetConfig) => {
    setPresetDraft({
      isAdding: true,
      editingId: preset.id,
      name: preset.name,
      description: preset.description ?? "",
      prompt: preset.prompt,
      mode: preset.mode,
      modelId: preset.modelId ?? "",
    });
  };

  const handleSave = async () => {
    if (!presetDraft.name.trim() || !presetDraft.prompt.trim()) return;
    await fetch(API_ROUTES.chatPresets, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(presetDraft.editingId ? { id: presetDraft.editingId } : {}),
        name: presetDraft.name,
        description: presetDraft.description,
        prompt: presetDraft.prompt,
        mode: presetDraft.mode,
        modelId: presetDraft.modelId || null,
      }),
    });
    resetDraft();
    loadPresets();
  };

  const handleDelete = async (id: string) => {
    await fetch(API_ROUTES.chatPresets, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    loadPresets();
  };

  return (
    <div className="p-6">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="font-bold font-mono text-foreground text-w-lg">Presets</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setPresetDraft((current) => ({ ...current, isAdding: true }))}
          className="uppercase-none"
        >
          <PlusIcon size={12} className="mr-1" /> Add preset
        </Button>
      </div>
      <p className="mb-4 font-mono text-dim text-w-sm">
        Reusable starter prompts for the chat composer. Presets can prefill the prompt, mode, and
        preferred model.
      </p>

      {presets.length > 0 && (
        <div className="mb-6 space-y-2">
          {presets.map((preset) => (
            <div key={preset.id} className="rounded-card border border-border bg-surface px-3 py-2">
              <div className="flex items-center gap-2">
                <SparklesIcon size={12} className="shrink-0 text-dim" />
                <span className="flex-1 font-mono text-foreground text-w-base">{preset.name}</span>
                <span className="rounded-item bg-accent/10 px-1.5 py-0.5 font-mono text-accent text-w-sm">
                  {preset.mode}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => startEdit(preset)}
                  className="icon-lg uppercase-none text-dim transition-colors hover:bg-transparent hover:text-foreground"
                  aria-label={`Edit ${preset.name}`}
                >
                  <PencilIcon size={11} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(preset.id)}
                  className="icon-lg uppercase-none text-dim transition-colors hover:bg-transparent hover:text-destructive"
                  aria-label={`Delete ${preset.name}`}
                >
                  <Trash2Icon size={11} />
                </Button>
              </div>
              {Boolean(preset.description) && (
                <p className="mt-0.5 ml-5 font-mono text-dim text-w-sm">{preset.description}</p>
              )}
              <pre className="scrollbar-thin mt-2 ml-5 max-h-widget-sm overflow-y-auto whitespace-pre-wrap rounded-item border border-border bg-background p-2 font-mono text-dim text-w-sm">
                {preset.prompt}
              </pre>
            </div>
          ))}
        </div>
      )}

      {Boolean(presetDraft.isAdding) && (
        <div className="space-y-3 rounded-card border border-border bg-surface p-4">
          <div className="space-y-1">
            <Label htmlFor="preset-name">Preset Name</Label>
            <Input
              id="preset-name"
              type="text"
              value={presetDraft.name}
              onChange={(e) => setPresetDraft((current) => ({ ...current, name: e.target.value }))}
              placeholder="Preset name..."
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="preset-desc">Description</Label>
            <Input
              id="preset-desc"
              type="text"
              value={presetDraft.description}
              onChange={(e) =>
                setPresetDraft((current) => ({ ...current, description: e.target.value }))
              }
              placeholder="Short description..."
              className="h-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="preset-mode">Mode</Label>
              <Select
                value={presetDraft.mode}
                onValueChange={(value) =>
                  setPresetDraft((current) => ({ ...current, mode: value as AssistantMode }))
                }
              >
                <SelectTrigger id="preset-mode" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Chat</SelectItem>
                  <SelectItem value="explore">Explore</SelectItem>
                  <SelectItem value="plan">Plan</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="qa">QA</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="preset-model">Model ID (optional)</Label>
              <Input
                id="preset-model"
                type="text"
                value={presetDraft.modelId}
                onChange={(e) =>
                  setPresetDraft((current) => ({ ...current, modelId: e.target.value }))
                }
                placeholder="gpt-4o"
                className="h-9"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="preset-prompt">Starter Prompt</Label>
            <Textarea
              id="preset-prompt"
              value={presetDraft.prompt}
              onChange={(e) =>
                setPresetDraft((current) => ({ ...current, prompt: e.target.value }))
              }
              placeholder="Starter prompt..."
              className="min-h-widget-sm"
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!presetDraft.name.trim() || !presetDraft.prompt.trim()}
              className="uppercase-none"
            >
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={resetDraft} uppercase={false}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

const IdentityPlaceholder = `You are an expert advisor for a personal project portfolio dashboard.
You have access to real-time data from all connected integrations via tools.
Your role is to proactively synthesize data, surface trends, and recommend concrete next steps aligned with the user's goals and priorities.
Always use available tools to fetch current data before answering data-related questions.
Be direct and specific — recommend actions, not just observations.`;

const ExtractionPlaceholder = `Extract memories from a conversation between a user and an AI advisor.
Focus on what the USER said — their statements are ground truth.
Extract: business metrics, decisions, corrections to AI errors, project facts, strategic context.
Return as JSON: { "memories": [{ "key": "...", "value": "...", "projectSlug": "..." }] }`;

function PromptsPanel() {
  const [promptState, setPromptState] = useState({
    identityPrompt: IdentityPlaceholder,
    extractionPrompt: ExtractionPlaceholder,
    identityIsCustom: false,
    extractionIsCustom: false,
    savingIdentity: false,
    savingExtraction: false,
    savedIdentity: false,
    savedExtraction: false,
  });

  useEffect(() => {
    fetchLlmConfig()
      .then((cfg) => {
        setPromptState((current) => ({
          ...current,
          identityPrompt: cfg.identityPrompt ?? current.identityPrompt,
          extractionPrompt: cfg.extractionPrompt ?? current.extractionPrompt,
          identityIsCustom: Boolean(cfg.identityPrompt),
          extractionIsCustom: Boolean(cfg.extractionPrompt),
        }));
      })
      .catch(() => {
        // ignore load errors
      });
  }, []);

  const handleSaveIdentity = async () => {
    setPromptState((current) => ({ ...current, savingIdentity: true }));
    await saveLlmConfig({ identityPrompt: promptState.identityPrompt || undefined });
    setPromptState((current) => ({
      ...current,
      identityIsCustom: true,
      savingIdentity: false,
      savedIdentity: true,
    }));
    setTimeout(() => {
      setPromptState((current) => ({ ...current, savedIdentity: false }));
    }, 2000);
  };

  const handleResetIdentity = async () => {
    setPromptState((current) => ({
      ...current,
      identityPrompt: IdentityPlaceholder,
      identityIsCustom: false,
    }));
    await saveLlmConfig({ identityPrompt: undefined });
  };

  const handleSaveExtraction = async () => {
    setPromptState((current) => ({ ...current, savingExtraction: true }));
    await saveLlmConfig({ extractionPrompt: promptState.extractionPrompt || undefined });
    setPromptState((current) => ({
      ...current,
      extractionIsCustom: true,
      savingExtraction: false,
      savedExtraction: true,
    }));
    setTimeout(() => {
      setPromptState((current) => ({ ...current, savedExtraction: false }));
    }, 2000);
  };

  const handleResetExtraction = async () => {
    setPromptState((current) => ({
      ...current,
      extractionPrompt: ExtractionPlaceholder,
      extractionIsCustom: false,
    }));
    await saveLlmConfig({ extractionPrompt: undefined });
  };

  return (
    <div className="space-y-8 p-6">
      <div>
        <h2 className="mb-1 font-bold font-mono text-foreground text-w-lg">Prompts</h2>
        <p className="font-mono text-dim text-w-sm">
          Customize the core instructions that shape how the AI reasons. Leave a field empty to use
          the built-in default. The AI can also update these mid-conversation.
        </p>
      </div>

      {/* Identity prompt */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold font-mono text-foreground text-w-base">
              Identity &amp; persona
            </p>
            <p className="mt-0.5 font-mono text-dim text-w-sm">
              The [IDENTITY] section at the top of every system prompt. Defines who the AI is and
              how it approaches problems.
            </p>
          </div>
          {Boolean(promptState.identityIsCustom) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleResetIdentity}
                  className="uppercase-none flex shrink-0 items-center gap-1 font-mono text-dim text-w-sm transition-colors hover:bg-transparent hover:text-warning"
                >
                  <RotateCcwIcon size={10} /> Reset
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reset to built-in default</TooltipContent>
            </Tooltip>
          )}
        </div>
        <Textarea
          value={promptState.identityPrompt}
          onChange={(e) =>
            setPromptState((current) => ({
              ...current,
              identityPrompt: e.target.value,
            }))
          }
          className="min-h-[160px] bg-background font-mono text-w-base"
        />
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleSaveIdentity}
            disabled={promptState.savingIdentity}
            className="uppercase-none"
          >
            {promptState.savingIdentity ? (
              <Loader2 size={12} className="mr-1.5 animate-spin" />
            ) : null}
            {promptState.savedIdentity ? "Saved" : "Save"}
          </Button>
          <span className="font-mono text-dim text-w-sm">
            {promptState.identityIsCustom ? "Custom" : "Using built-in default"}
          </span>
        </div>
      </div>

      {/* Extraction prompt */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold font-mono text-foreground text-w-base">Memory extraction</p>
            <p className="mt-0.5 font-mono text-dim text-w-sm">
              Controls what facts get promoted into persistent memory after a conversation finishes.
            </p>
          </div>
          {Boolean(promptState.extractionIsCustom) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleResetExtraction}
                  className="uppercase-none flex shrink-0 items-center gap-1 font-mono text-dim text-w-sm transition-colors hover:bg-transparent hover:text-warning"
                >
                  <RotateCcwIcon size={10} /> Reset
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reset to built-in default</TooltipContent>
            </Tooltip>
          )}
        </div>
        <Textarea
          value={promptState.extractionPrompt}
          onChange={(e) =>
            setPromptState((current) => ({
              ...current,
              extractionPrompt: e.target.value,
            }))
          }
          className="min-h-[160px] bg-background font-mono text-w-base"
        />
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleSaveExtraction}
            disabled={promptState.savingExtraction}
            className="uppercase-none"
          >
            {promptState.savingExtraction ? (
              <Loader2 size={12} className="mr-1.5 animate-spin" />
            ) : null}
            {promptState.savedExtraction ? "Saved" : "Save"}
          </Button>
          <span className="font-mono text-dim text-w-sm">
            {promptState.extractionIsCustom ? "Custom" : "Using built-in default"}
          </span>
        </div>
      </div>
    </div>
  );
}

interface MemoryEntry {
  id: string;
  key: string;
  value: string;
  projectSlug: string | null;
  updatedAt: string;
}

function MemoryPanel() {
  const [memories, setMemories] = useState<MemoryEntry[]>([]);

  const loadMemories = useCallback(() => {
    fetch(API_ROUTES.chatMemory)
      .then((res) => res.json())
      .then((data: MemoryEntry[]) => {
        if (Array.isArray(data)) setMemories(data);
      })
      .catch(() => {
        // Non-critical
      });
  }, []);

  useEffect(() => {
    loadMemories();
  }, [loadMemories]);

  const handleDelete = async (id: string) => {
    await fetch(API_ROUTES.chatMemory, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    loadMemories();
  };

  return (
    <div className="p-6">
      <h2 className="mb-1 font-bold font-mono text-foreground text-w-lg">Memory</h2>
      <p className="mb-4 font-mono text-dim text-w-sm">
        Facts the AI has saved across conversations. These are injected into the system prompt for
        context.
      </p>

      {memories.length === 0 ? (
        <p className="rounded-card border border-border border-dashed bg-surface py-8 text-center font-mono text-dim text-w-base">
          No memories yet. The AI will save facts when you ask it to remember things.
        </p>
      ) : (
        <div className="space-y-2">
          {memories.map((mem) => (
            <div
              key={mem.id}
              className="group rounded-card border border-border bg-surface px-3 py-2 transition-colors hover:border-accent/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-bold font-mono text-accent text-w-sm">{mem.key}</span>
                  {Boolean(mem.projectSlug) && (
                    <Badge className="ml-2 bg-secondary px-1 text-dim" size="xs">
                      {mem.projectSlug}
                    </Badge>
                  )}
                  <p className="mt-0.5 font-mono text-foreground-secondary text-w-base leading-relaxed">
                    {mem.value}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(mem.id)}
                  className="icon-lg uppercase-none mt-0.5 shrink-0 text-dim opacity-0 transition-all hover:bg-transparent hover:text-destructive group-hover:opacity-100"
                  aria-label={`Delete memory: ${mem.key}`}
                >
                  <Trash2Icon size={11} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skill Import Section — paste npx command or GitHub URL
// ---------------------------------------------------------------------------

interface AvailableSkill {
  name: string;
  path: string;
}

function SkillImportSection({ onInstalled }: { onInstalled: () => void }) {
  const [importState, setImportState] = useState({
    command: "",
    importing: false,
    error: null as string | null,
    success: null as string | null,
    availableSkills: null as AvailableSkill[] | null,
    context: null as { owner: string; repo: string } | null,
  });

  const handleImport = async (skillName?: string) => {
    setImportState((current) => ({
      ...current,
      importing: true,
      error: null,
      success: null,
      availableSkills: null,
    }));

    try {
      const res = await fetch(API_ROUTES.chatSkillsImport, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: importState.command, skillName }),
      });

      const data = await res.json();

      if (!res.ok) {
        setImportState((current) => ({
          ...current,
          error: data.error ?? "Import failed",
        }));
        return;
      }

      if (data.installed) {
        setImportState((current) => ({
          ...current,
          success: `Installed "${data.skill.name}" — available in next conversation.`,
          command: "",
        }));
        onInstalled();
        return;
      }

      if (data.availableSkills) {
        setImportState((current) => ({
          ...current,
          availableSkills: data.availableSkills,
          context: { owner: data.owner, repo: data.repo },
        }));
        return;
      }
    } catch {
      setImportState((current) => ({
        ...current,
        error: "Failed to connect to import API",
      }));
    } finally {
      setImportState((current) => ({ ...current, importing: false }));
    }
  };

  const handlePickSkill = (skillName: string) => {
    handleImport(skillName);
  };

  return (
    <div className="mb-6 space-y-3 rounded-card border border-border bg-surface-secondary p-4">
      <div>
        <p className="font-mono text-dim text-w-sm uppercase tracking-widest">Import from GitHub</p>
        <p className="mt-1 text-dim text-w-xs">
          Paste a <code className="rounded bg-muted px-1">npx skills add</code> command or GitHub
          URL.
        </p>
      </div>

      <div className="flex gap-2">
        <Input
          type="text"
          value={importState.command}
          onChange={(e) => {
            setImportState((current) => ({
              ...current,
              command: e.target.value,
              error: null,
              success: null,
              availableSkills: null,
            }));
          }}
          placeholder="npx skills add owner/repo --skill name"
          className="h-9 flex-1 font-mono text-w-sm"
        />
        <Button
          size="sm"
          onClick={() => handleImport()}
          disabled={!importState.command.trim() || importState.importing}
          className="uppercase-none shrink-0"
        >
          {importState.importing ? "Importing..." : "Import"}
        </Button>
      </div>

      {importState.error && (
        <p className="font-mono text-destructive text-w-xs">{importState.error}</p>
      )}

      {importState.success && (
        <p className="font-mono text-success text-w-xs">{importState.success}</p>
      )}

      {importState.availableSkills && (
        <div className="space-y-2">
          <p className="font-mono text-dim text-w-xs">
            Found {importState.availableSkills.length} skills in {importState.context?.owner}/
            {importState.context?.repo}. Pick one:
          </p>
          <div className="flex flex-wrap gap-2">
            {importState.availableSkills.map((skill) => (
              <Button
                key={skill.name}
                variant="outline"
                size="sm"
                onClick={() => handlePickSkill(skill.name)}
                className="uppercase-none font-mono"
                disabled={importState.importing}
              >
                {skill.name}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
