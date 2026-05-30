/* biome-ignore-all assist/source/organizeImports: Storybook imports are grouped for clarity in story files. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: story files import Storybook packages from the dedicated apps/storybook workspace. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports follow Storybook conventions. */
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { renderScaffoldStory } from "@radarboard/storybook-scaffold";
import { expect, fn, userEvent, within } from "storybook/test";
import { LayoutPresetPicker } from "../preset-picker";

const meta = {
  title: "Regression/LayoutPresetPicker",
  component: LayoutPresetPicker,
} satisfies Meta<typeof LayoutPresetPicker>;

export default meta;

type Story = StoryObj<typeof meta>;

export const BlueprintsOpen: Story = {
  args: {
    open: true,
    onOpenChange: fn(),
    onSelect: fn(),
    onSelectBlueprint: fn(),
    personas: ["marketing"],
    connectedIntegrations: ["github"],
  },
  render: (args) =>
    renderScaffoldStory({
      componentName: "LayoutPresetPicker",
      sourcePath: "apps/app/components/settings/settings-layouts/preset-picker.tsx",
      Component: LayoutPresetPicker,
      args,
    }),
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const blueprintCard = await body.findByRole("button", { name: /growth dashboard/i });
    await userEvent.click(blueprintCard);
    await expect(args.onSelectBlueprint).toHaveBeenCalled();
  },
};
