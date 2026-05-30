/* biome-ignore-all assist/source/organizeImports: Storybook story file. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: Storybook packages live in apps/storybook. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and metadata follow Storybook conventions. */
import preview from "@radarboard/storybook-preview";
import {
  DetailLink,
  DetailRow,
  Dialog,
  DialogBody,
  DialogCancelButton,
  DialogContent,
  DialogDescription,
  DialogDestructiveButton,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@radarboard/ui/dialog";

const meta = preview.meta({
  title: "UI/Dialog",
  component: Dialog,
  parameters: {
    layout: "centered",
  },
});

export default meta;

export const Default = meta.story({
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="border border-border bg-surface px-3 py-2 font-mono text-foreground-secondary text-xs uppercase tracking-wider"
        >
          Open dialog
        </button>
      </DialogTrigger>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Delete environment</DialogTitle>
          <DialogDescription>
            This removes the current environment configuration and cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-1">
            <DetailRow label="Project">Radarboard</DetailRow>
            <DetailRow label="Environment">Production</DetailRow>
          </div>
        </DialogBody>
        <DialogFooter>
          <DialogCancelButton>Cancel</DialogCancelButton>
          <DialogDestructiveButton>Delete</DialogDestructiveButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
});

export const DetailLayout = meta.story({
  render: () => (
    <div className="w-[360px] border border-border bg-surface">
      <DialogHeader>
        <DialogTitle>Webhook details</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <DetailRow label="Status">Active</DetailRow>
        <DetailRow label="Events">Push, release</DetailRow>
        <DetailRow label="Docs">
          <DetailLink href="https://example.com">Open docs</DetailLink>
        </DetailRow>
      </DialogBody>
    </div>
  ),
});
