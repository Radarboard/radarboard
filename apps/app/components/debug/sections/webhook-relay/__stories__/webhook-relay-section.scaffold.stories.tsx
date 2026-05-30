/* biome-ignore-all assist/source/organizeImports: generated Storybook scaffold. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: story files import Storybook packages from the dedicated apps/storybook workspace. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and generated identifiers follow Storybook conventions. */
import type { Meta } from "@storybook/nextjs-vite";
import { WebhookRelaySection } from "../index";
import { renderScaffoldStory } from "@radarboard/storybook-scaffold";

const meta = {
  title: "Components/Debug/Sections/Webhook Relay/WebhookRelaySection",
  component: WebhookRelaySection,
} satisfies Meta<typeof WebhookRelaySection>;

export default meta;

export const Default = {
  render: () =>
    renderScaffoldStory({
      componentName: "WebhookRelaySection",
      sourcePath: "apps/app/components/debug/sections/webhook-relay/index.tsx",
      Component: WebhookRelaySection,
      args: {},
    }),
};
