import {
  BASIC_3X3,
  generateGridTemplateAreas,
  getGridAreaName,
  getSortedCells,
  resolveColSizes,
  resolveRowSizes,
  sizesToGridTemplate,
} from "@radarboard/widget-engine/layouts";

export function DashboardSkeleton() {
  const sortedCells = getSortedCells(BASIC_3X3.cells);

  return (
    <div className="skeleton-shimmer flex h-screen w-full flex-col overflow-hidden">
      <div className="h-12 shrink-0 border-border border-b bg-surface" />
      <div className="h-10 shrink-0 border-border border-b bg-surface" />
      <div className="h-14 shrink-0 border-border border-b bg-surface" />

      <div className="flex min-h-0 flex-1 flex-row">
        <div className="w-12 shrink-0 border-border border-r bg-surface-raised" />

        <div
          className="dashboard-grid min-w-0 flex-1"
          style={{
            gridTemplateColumns: sizesToGridTemplate(resolveColSizes(BASIC_3X3)),
            gridTemplateRows: `${sizesToGridTemplate(resolveRowSizes(BASIC_3X3))} auto`,
            gridTemplateAreas: `${generateGridTemplateAreas(BASIC_3X3)} "ticker ticker ticker"`,
          }}
        >
          {sortedCells.map((cell) => (
            <div
              key={cell.id}
              className="dashboard-cell bg-surface"
              style={{ gridArea: getGridAreaName(cell.id) }}
            />
          ))}

          <div className="dashboard-ticker border-border border-t bg-surface" />
        </div>
      </div>
    </div>
  );
}
