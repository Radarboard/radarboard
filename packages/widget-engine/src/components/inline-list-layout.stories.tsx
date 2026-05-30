/* biome-ignore-all assist/source/organizeImports: Storybook story file. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: Storybook packages live in apps/storybook. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and metadata follow Storybook conventions. */
import preview from "@radarboard/storybook-preview";
import { InlineListHeader, InlineListRow } from "./inline-list-layout";

const defaultColumns = [
  { key: "query", label: "Query" },
  { key: "clicks", label: "Clicks", align: "right" as const },
  { key: "pos", label: "Pos", align: "right" as const },
];

const defaultRows = [
  [
    { key: "query", content: "ux patterns" },
    { key: "clicks", content: "8", align: "right" as const },
    { key: "pos", content: "4.0", align: "right" as const },
  ],
  [
    { key: "query", content: "drizzle lms.txt" },
    { key: "clicks", content: "3", align: "right" as const },
    { key: "pos", content: "3.0", align: "right" as const },
  ],
  [
    { key: "query", content: "frontend checklist" },
    { key: "clicks", content: "1", align: "right" as const },
    { key: "pos", content: "1.0", align: "right" as const },
  ],
];

const meta = preview.meta({
  title: "Widgets/Building Blocks/Rows & Lists/Inline Row List",
  component: InlineListHeader,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Header plus row layout for dense inline lists inside widgets. Use when tabular scanning is needed but a full data table would feel too heavy.",
      },
    },
  },
  args: {
    gridTemplateColumns: "minmax(0,1fr) 80px 48px",
    columns: defaultColumns,
    rows: defaultRows,
    interactiveRows: false,
  },
  argTypes: {
    gridTemplateColumns: {
      control: "text",
    },
    columns: {
      control: "object",
    },
    rows: {
      control: "object",
    },
    interactiveRows: {
      control: "boolean",
    },
  },
});

export default meta;

export const Default = meta.story({
  render: ({ gridTemplateColumns, columns, rows, interactiveRows }) => (
    <div className="w-[min(560px,calc(100vw-2rem))] border border-border bg-surface">
      <InlineListHeader gridTemplateColumns={gridTemplateColumns} columns={columns} />
      {rows.map((cells) => (
        <InlineListRow
          key={cells.map((cell) => `${cell.key}:${String(cell.content)}`).join("|")}
          gridTemplateColumns={gridTemplateColumns}
          cells={cells}
          onClick={interactiveRows ? () => undefined : undefined}
        />
      ))}
    </div>
  ),
});

export const InteractiveRows = meta.story({
  args: {
    interactiveRows: true,
  },
});
