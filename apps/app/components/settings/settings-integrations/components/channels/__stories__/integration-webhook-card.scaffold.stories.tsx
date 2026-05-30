/* biome-ignore-all assist/source/organizeImports: generated Storybook scaffold. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: story files import Storybook packages from the dedicated apps/storybook workspace. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and generated identifiers follow Storybook conventions. */
import type { Meta } from "@storybook/nextjs-vite";
import { IntegrationWebhookCard } from "../webhook-card";
import { renderScaffoldStory } from "@radarboard/storybook-scaffold";

const meta = {
  title: "Components/Settings/Settings Integrations/Channels/IntegrationWebhookCard",
  component: IntegrationWebhookCard,
} satisfies Meta<typeof IntegrationWebhookCard>;

export default meta;

export const Default = {
  render: () =>
    renderScaffoldStory({
      componentName: "IntegrationWebhookCard",
      sourcePath: "apps/app/components/settings/settings-integrations/components/channels/webhook-card.tsx",
      Component: IntegrationWebhookCard,
      args: {},
    }),
};
