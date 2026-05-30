/* biome-ignore-all assist/source/organizeImports: Storybook imports are grouped for clarity in story files. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: story files import Storybook packages from the dedicated apps/storybook workspace. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports follow Storybook conventions. */
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { INITIAL_ONBOARDING_STATE } from "@radarboard/feature-onboarding/types";
import { renderScaffoldStory } from "@radarboard/storybook-scaffold";
import { expect, fn, userEvent } from "storybook/test";
import { StepLayout } from "../step-layout";

const baseState = {
  ...INITIAL_ONBOARDING_STATE,
  profile: "marketing" as const,
  connectedIntegrations: ["github"],
  blueprintId: "growth-dashboard",
};

const meta = {
  title: "Regression/OnboardingLayoutStep",
  component: StepLayout,
} satisfies Meta<typeof StepLayout>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Blueprints: Story = {
  args: {
    state: baseState,
    onChange: fn(),
    onNext: fn(),
    onBack: fn(),
  },
  render: (args) =>
    renderScaffoldStory({
      componentName: "StepLayout",
      sourcePath: "apps/app/components/onboarding/step-layout.tsx",
      Component: StepLayout,
      args,
    }),
  play: async ({ args, canvas }) => {
    const blueprintCard = await canvas.findByRole("button", { name: /growth dashboard/i });
    await userEvent.click(blueprintCard);
    await expect(args.onChange).toHaveBeenCalled();
    await expect(args.onNext).not.toHaveBeenCalled();
  },
};

export const Templates: Story = {
  args: {
    state: baseState,
    onChange: fn(),
    onNext: fn(),
    onBack: fn(),
  },
  render: (args) =>
    renderScaffoldStory({
      componentName: "StepLayout",
      sourcePath: "apps/app/components/onboarding/step-layout.tsx",
      Component: StepLayout,
      args,
    }),
  play: async ({ args, canvas }) => {
    await userEvent.click(await canvas.findByRole("button", { name: /^templates$/i }));
    const templateCard = await canvas.findByRole("button", { name: /basic 3x3/i });
    await userEvent.click(templateCard);
    await expect(args.onChange).toHaveBeenCalled();
    await expect(args.onNext).not.toHaveBeenCalled();
  },
};
