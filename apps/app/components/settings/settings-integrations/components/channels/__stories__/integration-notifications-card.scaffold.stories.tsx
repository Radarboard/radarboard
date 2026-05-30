/* biome-ignore-all assist/source/organizeImports: generated Storybook scaffold. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: story files import Storybook packages from the dedicated apps/storybook workspace. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and generated identifiers follow Storybook conventions. */
import type { Meta } from "@storybook/nextjs-vite";
import { IntegrationNotificationsCard } from "../notification-card";
import { renderScaffoldStory } from "@radarboard/storybook-scaffold";

const meta = {
  title: "Components/Settings/Settings Integrations/Channels/IntegrationNotificationsCard",
  component: IntegrationNotificationsCard,
} satisfies Meta<typeof IntegrationNotificationsCard>;

export default meta;

export const Default = {
  render: () =>
    renderScaffoldStory({
      componentName: "IntegrationNotificationsCard",
      sourcePath: "apps/app/components/settings/settings-integrations/components/channels/notification-card.tsx",
      Component: IntegrationNotificationsCard,
      args: {},
    }),
};
