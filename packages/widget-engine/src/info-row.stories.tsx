/* biome-ignore-all assist/source/organizeImports: Storybook story file. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: Storybook packages live in apps/storybook. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and metadata follow Storybook conventions. */
import { Lightbulb, ShieldAlert } from "lucide-react";
import preview from "@radarboard/storybook-preview";
import { InfoRow } from "@radarboard/ui/info-row";
import { CompactProjectBadge } from "./components/compact-project-badge";

const meta = preview.meta({
  title: "Widgets/Building Blocks/Rows & Lists/Info Row",
  component: InfoRow,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Primary row primitive for feeds, alerts, and recent-activity lists. Use when one item should remain scannable and actionable in a single line or stacked metadata row.",
      },
    },
  },
  args: {
    title: "Fix stale Storybook proxy refresh on dev restart",
    subtitleStart: "radarboard",
    subtitleEnd: "5h ago",
    density: "compact",
    divider: true,
    variant: "single",
    accent: "destructive",
  },
  argTypes: {
    title: { control: "text" },
    subtitleStart: { control: "text" },
    subtitleEnd: { control: "text" },
    density: { control: "inline-radio", options: ["compact", "default"] },
    divider: { control: "boolean" },
    active: { control: "boolean" },
    variant: { control: "inline-radio", options: ["single", "double"] },
    accent: { control: "select", options: ["destructive", "accent"] },
    subtitle: { control: false },
    leading: { control: false },
    meta: { control: false },
    trailing: { control: false },
    trailingBottom: { control: false },
    className: { control: false },
    titleClassName: { control: false },
    subtitleClassName: { control: false },
    subtitleStartClassName: { control: false },
    subtitleEndClassName: { control: false },
    trailingClassName: { control: false },
    href: { control: false },
    target: { control: false },
    rel: { control: false },
    onClick: { control: false },
  },
});

export default meta;

export const Default = meta.story({
  render: ({ title, subtitleStart, subtitleEnd, variant, accent, ...args }) => (
    <div className="w-[min(560px,calc(100vw-2rem))] border border-border bg-surface">
      <InfoRow
        {...args}
        title={title}
        subtitleStart={
          <CompactProjectBadge
            color={accent === "destructive" ? "#e05555" : "#4ade80"}
            label={subtitleStart}
          />
        }
        subtitleEnd={subtitleEnd}
        leading={
          variant === "double" ? (
            <Lightbulb className="icon-xs text-accent" />
          ) : (
            <ShieldAlert className="icon-xs text-destructive" />
          )
        }
        onClick={() => undefined}
      />
    </div>
  ),
});

export const DoubleRow = meta.story({
  args: {
    title: "Introduce recipe thumbnails for dashboard layouts",
    subtitleEnd: "6d ago",
    variant: "double",
    accent: "accent",
  },
});
