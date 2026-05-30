"use client";

import { useDashboard } from "@radarboard/hooks/use-dashboard";
import {
  DEFAULT_THEME_FAMILY_ID,
  DEFAULT_THEME_MODE,
  type ThemeMode,
  themeFamilies,
} from "@radarboard/themes";
import type { DisplayCurrency } from "@radarboard/types/dashboard";
import type { FontScale, TickerSpeed } from "@radarboard/types/database";
import { VIEW_STATE_QUERY_KEYS } from "@radarboard/types/view-state";
import { Button } from "@radarboard/ui/button";
import { EmptyState } from "@radarboard/ui/empty-state";
import { Input } from "@radarboard/ui/input";
import { Switch } from "@radarboard/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@radarboard/ui/toggle-group";
import { cn } from "@radarboard/utils/cn";
import { getSupportedTimeZones, isValidTimeZone } from "@radarboard/utils/timezone";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { SettingsSectionNav } from "../section-nav";
import { SettingsPageLayout } from "../settings-page-layout";
import type { SettingsAppearanceSection as AppearanceSection } from "../settings-storage";

const APPEARANCE_SECTIONS: {
  id: AppearanceSection;
  label: string;
  keywords: string[];
}[] = [
  {
    id: "display",
    label: "Display",
    keywords: [
      "display",
      "typography",
      "font",
      "text",
      "preview",
      "currency",
      "money",
      "usd",
      "cad",
    ],
  },
  {
    id: "timezone",
    label: "Timezone",
    keywords: ["timezone", "time zone", "today", "date", "range", "filter"],
  },
  {
    id: "ticker",
    label: "Ticker",
    keywords: ["ticker", "activity", "bottom bar", "sources", "speed"],
  },
];

const DEFAULT_APPEARANCE_SECTION: AppearanceSection = APPEARANCE_SECTIONS[0]?.id ?? "display";
const APPEARANCE_SECTION_IDS = ["display", "timezone", "ticker"] as const;

const FONT_SCALE_OPTIONS: { value: FontScale; label: string; description: string }[] = [
  { value: "sm", label: "Small", description: "Compact text and denser widgets." },
  { value: "md", label: "Default", description: "Balanced typography across the dashboard." },
  { value: "lg", label: "Large", description: "Larger widget text and roomier hierarchy." },
];

const TICKER_SPEED_OPTIONS: { value: TickerSpeed; label: string }[] = [
  { value: "slow", label: "Slow" },
  { value: "normal", label: "Normal" },
  { value: "fast", label: "Fast" },
];

const TICKER_SOURCES = [
  { key: "github" as const, label: "GitHub" },
  { key: "linear" as const, label: "Linear" },
  { key: "vercel" as const, label: "Vercel" },
  { key: "manual" as const, label: "Manual" },
];

const THEME_MODE_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

function matchesSection(query: string, keywords: string[]): boolean {
  if (!query) return true;
  return keywords.some((keyword) => keyword.includes(query));
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-panel border border-border bg-surface p-4">
      <div className="mb-4">
        <div className="font-mono text-dim text-w-sm uppercase tracking-widest">{title}</div>
        {description ? (
          <div className="mt-1 font-mono text-dim/60 text-w-sm">{description}</div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function TogglePill({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      onClick={onClick}
      className={cn(
        "h-auto rounded-item px-3 py-2 font-mono text-w-sm uppercase tracking-widest transition-colors",
        active
          ? "border-accent/30 bg-accent/10 text-accent"
          : "border-border bg-surface-raised text-dim hover:text-foreground-secondary"
      )}
    >
      {children}
    </Button>
  );
}

function SwitchRow({
  label,
  description,
  checked,
  onToggle,
}: {
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-card border border-border bg-surface-raised px-4 py-3">
      <div>
        <div className="font-mono text-foreground-secondary text-w-sm">{label}</div>
        <div className="mt-1 font-mono text-dim text-w-sm">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onToggle} aria-label={`Toggle ${label}`} />
    </div>
  );
}

function DisplaySection({
  appearance,
  updateAppearance,
}: Pick<ReturnType<typeof useDashboard>, "appearance" | "updateAppearance">) {
  const activeThemeFamilyId = appearance.themeFamilyId ?? DEFAULT_THEME_FAMILY_ID;
  const activeThemeMode = appearance.themeMode ?? DEFAULT_THEME_MODE;

  return (
    <Panel
      title="Theme"
      description="Choose a theme family and then decide whether it follows light, dark, or your system preference."
    >
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        {themeFamilies.map((family) => {
          const selected = family.id === activeThemeFamilyId;

          return (
            <Button
              key={family.id}
              type="button"
              variant="ghost"
              uppercase={false}
              onClick={() =>
                updateAppearance({
                  ...appearance,
                  themeFamilyId: family.id,
                  themeMode: activeThemeMode,
                })
              }
              className={cn(
                "h-auto w-full flex-col items-stretch rounded-card border px-3 py-3 text-left",
                selected
                  ? "border-accent bg-surface-raised text-foreground shadow-glow"
                  : "border-border bg-surface hover:border-accent/20 hover:bg-surface-raised"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-foreground text-w-sm uppercase tracking-widest">
                    {family.label}
                  </div>
                  <div className="mt-1 truncate font-mono text-dim/70 text-w-xs uppercase tracking-wider">
                    {family.fontMeta.label}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span
                    className="h-2.5 w-2.5 rounded-full border border-border"
                    style={{ backgroundColor: family.preview.surface }}
                  />
                  <span
                    className="h-2.5 w-2.5 rounded-full border border-border"
                    style={{ backgroundColor: family.preview.accent }}
                  />
                  <span
                    className="h-2.5 w-2.5 rounded-full border border-border"
                    style={{ backgroundColor: family.preview.text }}
                  />
                </div>
              </div>
              <div className="mt-3 grid grid-cols-[1fr_auto] items-end gap-3 border border-border/60 bg-background/70 p-2">
                <div className="min-w-0">
                  <div
                    className="text-foreground text-w-lg leading-none"
                    style={{
                      fontFamily: family.fonts.sans,
                      fontSize: `calc(var(--text-w-lg) * ${family.preview.sansScale})`,
                    }}
                  >
                    Aa
                  </div>
                  <div className="mt-1 truncate font-mono text-dim/70 text-w-xs uppercase tracking-wider">
                    Sans preview
                  </div>
                </div>
                <div className="min-w-0 text-right">
                  <div
                    className="text-foreground text-w-base leading-none"
                    style={{
                      fontFamily: family.fonts.mono,
                      fontSize: `calc(var(--text-w-base) * ${family.preview.monoScale})`,
                    }}
                  >
                    0123
                  </div>
                  <div className="mt-1 truncate font-mono text-dim/70 text-w-xs uppercase tracking-wider">
                    Mono preview
                  </div>
                </div>
              </div>
            </Button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <span className="font-mono text-dim text-w-xs uppercase tracking-widest">Mode</span>
        <ToggleGroup
          type="single"
          value={activeThemeMode}
          onValueChange={(value) => {
            if (!value) return;
            updateAppearance({
              ...appearance,
              themeFamilyId: activeThemeFamilyId,
              themeMode: value as ThemeMode,
            });
          }}
          className="shrink-0"
        >
          {THEME_MODE_OPTIONS.map((option) => (
            <ToggleGroupItem key={option.value} value={option.value} className="min-w-[96px]">
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </Panel>
  );
}

function TypographySection({
  appearance,
  updateAppearance,
}: Pick<ReturnType<typeof useDashboard>, "appearance" | "updateAppearance">) {
  return (
    <Panel
      title="Typography Scale"
      description="Control the visual density of widget chrome and shared template sections."
    >
      <div className="flex items-center gap-3">
        <span className="font-mono text-dim text-w-xs uppercase tracking-widest">Scale</span>
        <ToggleGroup
          type="single"
          value={appearance.fontScale}
          onValueChange={(value) => {
            if (!value) return;
            updateAppearance({ ...appearance, fontScale: value as FontScale });
          }}
          className="shrink-0"
        >
          {FONT_SCALE_OPTIONS.map((opt) => (
            <ToggleGroupItem key={opt.value} value={opt.value} className="min-w-[96px]">
              {opt.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="mt-2 font-mono text-dim text-w-sm">
        {FONT_SCALE_OPTIONS.find((option) => option.value === appearance.fontScale)?.description ??
          ""}
      </div>

      <div className="mt-4 max-w-content-max rounded-card border border-border bg-surface-raised p-4">
        <div data-font-scale={appearance.fontScale !== "md" ? appearance.fontScale : undefined}>
          <div className="font-mono text-dim text-w-sm uppercase tracking-wider">Revenue</div>
          <div className="mt-2 font-bold font-mono text-foreground text-w-xl">$12,450</div>
          <div className="mt-1 font-mono text-dim/80 text-w-sm">+12.5% from last period</div>
          <div className="mt-3 flex items-center gap-3 font-mono text-dim/60 text-w-sm">
            <span className="text-success">Connected</span>
          </div>
        </div>
      </div>

      <div className="mt-4 max-w-content-max space-y-2 font-mono text-dim text-w-sm">
        <p>The scale applies across widget headers, KPIs, and shared template sections.</p>
        <p>Widget-level overrides can still opt into a different local scale when needed.</p>
      </div>
    </Panel>
  );
}

const AVAILABLE_CURRENCIES: { value: DisplayCurrency; label: string }[] = [
  { value: "USD", label: "USD" },
  { value: "CAD", label: "CAD" },
];

function CurrencySection({
  currencies,
  updatePreferences,
}: {
  currencies: DisplayCurrency[];
  updatePreferences: ReturnType<typeof useDashboard>["updatePreferences"];
}) {
  const toggle = (value: DisplayCurrency) => {
    const isActive = currencies.includes(value);
    if (isActive && currencies.length <= 1) return;
    const next = isActive ? currencies.filter((c) => c !== value) : [...currencies, value];
    updatePreferences({ currencies: next });
  };

  return (
    <Panel
      title="Currencies"
      description="Select which currencies appear in the top bar toggle. The toggle is hidden when only one is active."
    >
      <div className="flex max-w-content-max flex-wrap gap-1.5">
        {AVAILABLE_CURRENCIES.map(({ value, label }) => (
          <TogglePill key={value} active={currencies.includes(value)} onClick={() => toggle(value)}>
            {label}
          </TogglePill>
        ))}
      </div>
      <div className="mt-2 font-mono text-dim text-w-sm">
        {currencies.length <= 1
          ? "Add a second currency to show the currency toggle in the dashboard header."
          : `Showing ${currencies.join(" / ")} toggle in the header.`}
      </div>
    </Panel>
  );
}

function TimezoneSection({
  effectiveTimezone,
  timezonePreference,
  updatePreferences,
}: Pick<
  ReturnType<typeof useDashboard>,
  "effectiveTimezone" | "timezonePreference" | "updatePreferences"
>) {
  const [timezoneInput, setTimezoneInput] = useState(
    timezonePreference === "auto" ? "" : timezonePreference
  );
  const supportedTimeZones = useMemo(() => getSupportedTimeZones(), []);
  const valid = timezoneInput.trim().length === 0 || isValidTimeZone(timezoneInput);

  const apply = () => {
    const nextValue = timezoneInput.trim();
    if (!nextValue || !isValidTimeZone(nextValue)) return;
    updatePreferences({ timezone: nextValue });
  };

  return (
    <Panel
      title="Timezone"
      description="Set the timezone used for `today`, rolling date windows, and other calendar-bound dashboard requests."
    >
      <div className="flex flex-wrap items-center gap-2">
        <TogglePill
          active={timezonePreference === "auto"}
          onClick={() => updatePreferences({ timezone: "auto" })}
        >
          Auto (browser)
        </TogglePill>
        <div className="font-mono text-dim text-w-sm">
          Current effective timezone:{" "}
          <span className="text-foreground-secondary">{effectiveTimezone}</span>
        </div>
      </div>

      <div className="relative mt-4 max-w-[560px]">
        <Input
          list="dashboard-timezones"
          type="text"
          value={timezoneInput}
          placeholder="America/Toronto"
          onChange={(event) => setTimezoneInput(event.target.value)}
          onBlur={apply}
          className={cn(
            "h-10 w-full pr-20",
            !valid && "border-destructive focus:border-destructive"
          )}
        />
        <Button
          type="button"
          variant="outline"
          onClick={apply}
          disabled={!timezoneInput.trim() || !valid}
          className="uppercase-none absolute top-1 right-1 h-8 rounded-item px-2.5 font-mono text-w-sm uppercase tracking-widest transition-colors disabled:opacity-40"
        >
          Apply
        </Button>
        <datalist id="dashboard-timezones">
          {supportedTimeZones.map((timeZone) => (
            <option key={timeZone} value={timeZone} />
          ))}
        </datalist>
      </div>

      <div className="mt-2 max-w-[560px] font-mono text-dim text-w-sm">
        {valid
          ? "Use an IANA timezone like `Europe/Paris` or `America/Los_Angeles`."
          : "Enter a valid IANA timezone name before applying the override."}
      </div>

      <div className="mt-4 max-w-content-max space-y-2 font-mono text-dim text-w-sm">
        <p>`Today` and rolling time ranges use this timezone for day boundaries.</p>
        <p>Date-sensitive requests and cache keys include the effective timezone.</p>
        <p>Absolute date displays in detail views follow the same effective timezone.</p>
      </div>
    </Panel>
  );
}

function TickerSection({
  appearance,
  updateAppearance,
}: Pick<ReturnType<typeof useDashboard>, "appearance" | "updateAppearance">) {
  const ticker = {
    enabled: appearance.ticker?.enabled ?? true,
    speed: appearance.ticker?.speed ?? "normal",
    sources: {
      github: appearance.ticker?.sources?.github ?? true,
      linear: appearance.ticker?.sources?.linear ?? true,
      vercel: appearance.ticker?.sources?.vercel ?? true,
      manual: appearance.ticker?.sources?.manual ?? true,
    },
    showHealthAlerts: appearance.ticker?.showHealthAlerts ?? true,
  };

  const updateTicker = (patch: Partial<typeof ticker>) => {
    updateAppearance({
      ...appearance,
      ticker: { ...ticker, ...patch },
    });
  };

  const toggleSource = (key: keyof typeof ticker.sources) => {
    updateTicker({ sources: { ...ticker.sources, [key]: !ticker.sources[key] } });
  };

  return (
    <Panel
      title="Activity Rail"
      description="Control the bottom activity rail that summarizes deploys, issues, and manual notes."
    >
      <SwitchRow
        label="Enabled"
        description="Show the ticker across the bottom edge of the dashboard."
        checked={ticker.enabled}
        onToggle={() => updateTicker({ enabled: !ticker.enabled })}
      />

      <div className={cn("mt-4 space-y-4", !ticker.enabled && "pointer-events-none opacity-40")}>
        <div>
          <div className="mb-2 font-mono text-dim text-w-sm uppercase tracking-widest">
            Scroll speed
          </div>
          <div className="flex max-w-[520px] items-center gap-1 rounded-card border border-border bg-background/50 p-1">
            {TICKER_SPEED_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                type="button"
                variant="ghost"
                onClick={() => updateTicker({ speed: opt.value })}
                className={cn(
                  "h-auto flex-1 rounded-item px-3 py-2 font-mono font-normal text-w-sm uppercase tracking-widest transition-colors",
                  ticker.speed === opt.value
                    ? "bg-secondary text-foreground"
                    : "text-dim hover:bg-muted hover:text-foreground-secondary"
                )}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 font-mono text-dim text-w-sm uppercase tracking-widest">Sources</div>
          <div className="flex max-w-content-max flex-wrap gap-1.5">
            {TICKER_SOURCES.map(({ key, label }) => (
              <TogglePill key={key} active={ticker.sources[key]} onClick={() => toggleSource(key)}>
                {label}
              </TogglePill>
            ))}
          </div>
        </div>

        <SwitchRow
          label="Health alerts"
          description="Show the red DOWN badge when a monitored service is down."
          checked={ticker.showHealthAlerts}
          onToggle={() => updateTicker({ showHealthAlerts: !ticker.showHealthAlerts })}
        />
      </div>
    </Panel>
  );
}

export function SettingsAppearance() {
  const dashboard = useDashboard();
  const [activeSectionParam, setActiveSectionParam] = useQueryState(
    VIEW_STATE_QUERY_KEYS.appearanceSection,
    parseAsStringLiteral(APPEARANCE_SECTION_IDS)
  );
  const [searchQuery, setSearchQuery] = useState("");
  const trimmedQuery = searchQuery.trim().toLowerCase();
  const visibleSections = APPEARANCE_SECTIONS.filter((section) =>
    matchesSection(trimmedQuery, section.keywords)
  );
  const activeSection = activeSectionParam ?? DEFAULT_APPEARANCE_SECTION;
  const timezoneStatus =
    dashboard.timezonePreference === "auto"
      ? `Auto · ${dashboard.effectiveTimezone}`
      : `Manual · ${dashboard.effectiveTimezone}`;

  useEffect(() => {
    if (activeSectionParam === activeSection) return;
    setActiveSectionParam(activeSection);
  }, [activeSection, activeSectionParam, setActiveSectionParam]);

  useEffect(() => {
    if (visibleSections.length === 0) return;
    if (visibleSections.some((section) => section.id === activeSection)) return;
    setActiveSectionParam(visibleSections[0]?.id ?? DEFAULT_APPEARANCE_SECTION);
  }, [activeSection, setActiveSectionParam, visibleSections]);

  return (
    <SettingsPageLayout
      title="Appearance"
      description="Tune dashboard presentation and the timezone used by date-sensitive widgets."
      statusText={timezoneStatus}
      statusColor="muted"
      searchPlaceholder="Search appearance sections..."
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      headerSlot={
        <SettingsSectionNav
          items={visibleSections.map((section) => ({
            id: section.id,
            label: section.label,
          }))}
          activeId={activeSection}
          onChange={(sectionId) => {
            if (sectionId) setActiveSectionParam(sectionId as AppearanceSection);
          }}
        />
      }
    >
      {visibleSections.length === 0 ? (
        <EmptyState message="No appearance sections match your search." />
      ) : (
        <div className="max-w-[820px] space-y-5">
          {activeSection === "display" && (
            <>
              <DisplaySection
                appearance={dashboard.appearance}
                updateAppearance={dashboard.updateAppearance}
              />
              <TypographySection
                appearance={dashboard.appearance}
                updateAppearance={dashboard.updateAppearance}
              />
              <CurrencySection
                currencies={dashboard.currencies}
                updatePreferences={dashboard.updatePreferences}
              />
            </>
          )}
          {activeSection === "timezone" && (
            <TimezoneSection
              effectiveTimezone={dashboard.effectiveTimezone}
              timezonePreference={dashboard.timezonePreference}
              updatePreferences={dashboard.updatePreferences}
            />
          )}
          {activeSection === "ticker" && (
            <TickerSection
              appearance={dashboard.appearance}
              updateAppearance={dashboard.updateAppearance}
            />
          )}
        </div>
      )}
    </SettingsPageLayout>
  );
}
