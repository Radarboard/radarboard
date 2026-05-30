/* biome-ignore-all assist/source/organizeImports: Storybook imports are grouped for clarity in story files. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: story files import Storybook packages from the dedicated apps/storybook workspace. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports follow Storybook conventions. */
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RelaySettingsPanel, RelayUsagePanel } from "../../../app/components/settings/settings-webhook-relay/index";

const noop = () => undefined;

const meta = {
  title: "Components/Settings/RelaySettingsPanel",
  component: RelaySettingsPanel,
} satisfies Meta<typeof RelaySettingsPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

const serviceLabels = ["GitHub", "Slack", "Linear"];

export const EmptyState: Story = {
  args: {
    relayUrl: "",
    onSaveRelayUrl: noop,
    serviceLabels,
  },
};

export const ConfiguredState: Story = {
  args: {
    relayUrl: "https://relay.radarboard.app",
    onSaveRelayUrl: noop,
    serviceLabels,
  },
};

export const UsedByPanel: StoryObj<typeof RelayUsagePanel> = {
  render: () => (
    <RelayUsagePanel relayUrl="https://relay.radarboard.app" serviceLabels={serviceLabels} />
  ),
};
