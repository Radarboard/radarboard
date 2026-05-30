/* biome-ignore-all assist/source/organizeImports: Storybook imports are grouped for clarity in story files. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: story files import Storybook packages from the dedicated apps/storybook workspace. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports follow Storybook conventions. */
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Badge } from "@radarboard/ui/badge";
import { Blocks, CheckCircle2, Plug, Puzzle, Workflow } from "lucide-react";
import { SettingsCatalogCard } from "../../../app/components/settings/settings-catalog-card/index";

const meta = {
  title: "Components/Settings/SettingsCatalogCard",
  component: SettingsCatalogCard,
} satisfies Meta<typeof SettingsCatalogCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Enabled: Story = {
  args: {
    enabled: true,
    title: "Tasks",
    titleMeta: "v0.1.0",
    description: "Task management with keyboard-first workflows and Pomodoro support.",
    openAriaLabel: "Configure Tasks",
    checked: true,
    switchAriaLabel: "Disable Tasks",
    icon: (
      <span className="icon-sm inline-flex items-center justify-center rounded-item border border-border bg-secondary text-foreground-secondary">
        <Blocks className="h-2.5 w-2.5" />
      </span>
    ),
    status: (
      <div className="flex items-center gap-1.5 font-mono text-muted-foreground text-w-sm">
        <CheckCircle2 className="icon-xs text-success" />
        2/2 connected
      </div>
    ),
    badges: (
      <>
        <Badge variant="secondary">dock when enabled</Badge>
        <Badge variant="secondary">1 widget</Badge>
        <Badge variant="secondary">13 MCP tools</Badge>
        <Badge variant="secondary">fullscreen</Badge>
      </>
    ),
  },
};

export const DisabledButReadable: Story = {
  args: {
    enabled: false,
    title: "Bookmarks",
    titleMeta: "v0.1.0",
    description: "Save, organize, and quickly access bookmarks with tagging and search.",
    openAriaLabel: "Configure Bookmarks",
    checked: false,
    switchAriaLabel: "Enable Bookmarks",
    icon: (
      <span className="icon-sm inline-flex items-center justify-center rounded-item border border-border bg-muted text-muted-foreground">
        <Blocks className="h-2.5 w-2.5" />
      </span>
    ),
    badges: (
      <>
        <Badge variant="secondary">dock when enabled</Badge>
        <Badge variant="secondary">1 widget</Badge>
        <Badge variant="secondary">4 MCP tools</Badge>
        <Badge variant="secondary">side-panel</Badge>
      </>
    ),
  },
};

export const PluginEnabled: Story = {
  args: {
    enabled: true,
    title: "Tasks",
    titleMeta: "v0.1.0",
    description:
      "Task management with Pomodoro timer, project grouping, and keyboard-first workflow.",
    openAriaLabel: "Configure Tasks plugin",
    checked: true,
    switchAriaLabel: "Disable Tasks plugin",
    icon: (
      <span className="icon-sm inline-flex items-center justify-center rounded-item border border-border bg-secondary text-foreground-secondary">
        <Puzzle className="h-2.5 w-2.5" />
      </span>
    ),
    badges: (
      <>
        <Badge variant="secondary">dock when enabled</Badge>
        <Badge variant="secondary">1 widget</Badge>
        <Badge variant="secondary">13 MCP tools</Badge>
        <Badge variant="secondary">fullscreen</Badge>
      </>
    ),
  },
};

export const PluginDisabled: Story = {
  args: {
    enabled: false,
    title: "Expenses",
    titleMeta: "v0.1.0",
    description: "Track service costs, billing cycles, and upcoming renewals across your stack.",
    openAriaLabel: "Configure Expenses plugin",
    checked: false,
    switchAriaLabel: "Enable Expenses plugin",
    icon: (
      <span className="icon-sm inline-flex items-center justify-center rounded-item border border-border bg-muted text-muted-foreground">
        <Puzzle className="h-2.5 w-2.5" />
      </span>
    ),
    badges: (
      <>
        <Badge variant="secondary">dock when enabled</Badge>
        <Badge variant="secondary">1 widget</Badge>
        <Badge variant="secondary">11 MCP tools</Badge>
        <Badge variant="secondary">fullscreen</Badge>
      </>
    ),
  },
};

export const WidgetEnabled: Story = {
  args: {
    enabled: true,
    title: "Revenue",
    description:
      "Monitor MRR, churn, trial conversion, and customer growth from one compact widget.",
    openAriaLabel: "Configure Revenue widget",
    checked: true,
    switchAriaLabel: "Disable Revenue widget",
    icon: (
      <span className="icon-sm inline-flex items-center justify-center rounded-item border border-border bg-secondary text-foreground-secondary">
        <Blocks className="h-2.5 w-2.5" />
      </span>
    ),
    status: (
      <div className="flex items-center gap-1.5 font-mono text-muted-foreground text-w-sm">
        <CheckCircle2 className="icon-xs text-success" />
        1/1 connected
      </div>
    ),
    badges: <Badge variant="secondary">enabled in layout</Badge>,
  },
};

export const WidgetAvailable: Story = {
  args: {
    enabled: false,
    title: "SEO Overview",
    description:
      "Surface rankings, clicks, impressions, and query movement without leaving Radarboard.",
    openAriaLabel: "Configure SEO Overview widget",
    checked: false,
    switchAriaLabel: "Enable SEO Overview widget",
    icon: (
      <span className="icon-sm inline-flex items-center justify-center rounded-item border border-border bg-muted text-muted-foreground">
        <Blocks className="h-2.5 w-2.5" />
      </span>
    ),
    status: (
      <div className="flex items-center gap-1.5 font-mono text-muted-foreground text-w-sm">
        <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-dim" />
        Not connected
      </div>
    ),
    badges: <Badge variant="secondary">available for this layout</Badge>,
  },
};

export const IntegrationConfigured: Story = {
  args: {
    enabled: true,
    title: "GitHub",
    description: "Sync repositories, pull requests, issues, deployments, and release signals.",
    openAriaLabel: "Configure GitHub integration",
    icon: (
      <div className="relative">
        <span className="icon-sm inline-flex items-center justify-center rounded-item border border-border bg-secondary text-foreground-secondary">
          <Plug className="h-2.5 w-2.5" />
        </span>
        <span className="absolute -right-0.5 -bottom-0.5 h-2 w-2 rounded-full border-2 border-surface-raised bg-success" />
      </div>
    ),
    status: <div className="font-mono text-muted-foreground text-w-sm">3 connections</div>,
    badges: (
      <>
        <Badge variant="success">API</Badge>
        <Badge variant="secondary">MCP</Badge>
      </>
    ),
  },
};

export const IntegrationNotConfigured: Story = {
  args: {
    enabled: false,
    title: "Linear",
    description: "Pull project, issue, and roadmap signals into Radarboard workflows and widgets.",
    openAriaLabel: "Configure Linear integration",
    icon: (
      <div className="relative">
        <span className="icon-sm inline-flex items-center justify-center rounded-item border border-border bg-muted text-muted-foreground">
          <Workflow className="h-2.5 w-2.5" />
        </span>
        <span className="absolute -right-0.5 -bottom-0.5 h-2 w-2 rounded-full border-2 border-surface bg-dim" />
      </div>
    ),
    status: <div className="font-mono text-muted-foreground text-w-sm">Not configured</div>,
    badges: <Badge variant="secondary">MCP</Badge>,
  },
};

export const Minimal: Story = {
  args: {
    enabled: true,
    title: "Webhook Relay",
    description: "Minimal card layout with no status row and no badges.",
    openAriaLabel: "Configure Webhook Relay",
    checked: true,
    switchAriaLabel: "Disable Webhook Relay",
    icon: (
      <span className="icon-sm inline-flex items-center justify-center rounded-item border border-border bg-secondary text-foreground-secondary">
        <Workflow className="h-2.5 w-2.5" />
      </span>
    ),
  },
};
