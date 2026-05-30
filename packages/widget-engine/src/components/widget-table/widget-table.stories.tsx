/* biome-ignore-all assist/source/organizeImports: Storybook story file. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: Storybook packages live in apps/storybook. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and metadata follow Storybook conventions. */
import preview from "@radarboard/storybook-preview";
import { WidgetTable } from "@radarboard/widget-engine/widget-table";

const meta = preview.meta({
  title: "Widgets/Building Blocks/Rows & Lists/Data Table",
  component: WidgetTable,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Full widget-grade data table with filtering, sorting, and resize behavior. Use for multi-column inspection tasks. Avoid it when a short inline row list communicates the data faster.",
      },
    },
  },
  args: {
    stateKey: "story:widget-table",
    columns: [
      { accessorKey: "query", header: "Query" },
      { accessorKey: "clicks", header: "Clicks", meta: { align: "right" as const } },
      { accessorKey: "position", header: "Pos", meta: { align: "right" as const } },
    ],
    data: [
      { query: "ux patterns", clicks: 8, position: "4.0" },
      { query: "drizzle lms.txt", clicks: 3, position: "3.0" },
      { query: "frontend checklist", clicks: 1, position: "1.0" },
    ],
    filterPlaceholder: "Filter rows",
    height: 280,
    width: 640,
  },
  argTypes: {
    columns: { control: "object" },
    data: { control: "object" },
    stateKey: { control: "text" },
    filterPlaceholder: { control: "text" },
    height: { control: { type: "range", min: 180, max: 480, step: 10 } },
    width: { control: { type: "range", min: 320, max: 960, step: 10 } },
    defaultSorting: { control: false },
    onRowClick: { control: false },
    emptyMessage: { control: false },
    className: { control: false },
  },
});

export default meta;

export const Default = meta.story({
  render: ({ height, width, ...args }) => (
    <div
      className="border border-border bg-surface"
      style={{ height: `${height}px`, width: `min(${width}px, calc(100vw - 2rem))` }}
    >
      <WidgetTable {...args} />
    </div>
  ),
});

export const Empty = meta.story({
  args: {
    data: [],
    emptyMessage: "No rows available",
  },
});
