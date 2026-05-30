import type { LayoutCell, LayoutDefinition } from "@radarboard/types/database";

export interface LayoutDimensions {
  rowCount: number;
  colCount: number;
}

export interface TrackEditResult {
  layout: LayoutDefinition;
  removedCellIds: string[];
}

export interface LayoutCellRect {
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
}

export interface HorizontalResizeHandleDescriptor {
  id: string;
  row: number;
  colStart: number;
  colSpan: number;
  columns: number[];
  leftPct: number;
  topPct: number;
  widthPct: number;
}

let cellCounter = 0;

/** The default 3x3 grid layout. Cannot be deleted or renamed. */
export const BASIC_3X3: LayoutDefinition = {
  id: "basic-3x3",
  name: "Basic 3×3",
  cells: [
    { id: "cell-1", rowStart: 0, colStart: 0, rowSpan: 1, colSpan: 1 },
    { id: "cell-2", rowStart: 0, colStart: 1, rowSpan: 1, colSpan: 1 },
    { id: "cell-3", rowStart: 0, colStart: 2, rowSpan: 1, colSpan: 1 },
    { id: "cell-4", rowStart: 1, colStart: 0, rowSpan: 1, colSpan: 1 },
    { id: "cell-5", rowStart: 1, colStart: 1, rowSpan: 1, colSpan: 1 },
    { id: "cell-6", rowStart: 1, colStart: 2, rowSpan: 1, colSpan: 1 },
    { id: "cell-7", rowStart: 2, colStart: 0, rowSpan: 1, colSpan: 1 },
    { id: "cell-8", rowStart: 2, colStart: 1, rowSpan: 1, colSpan: 1 },
    { id: "cell-9", rowStart: 2, colStart: 2, rowSpan: 1, colSpan: 1 },
  ],
  colSizes: [33.33, 33.33, 33.34],
  rowSizes: [33.33, 33.33, 33.34],
};

export const BASIC_4X3: LayoutDefinition = {
  id: "basic-4x3",
  name: "Basic 4×3",
  cells: [
    { id: "cell-1", rowStart: 0, colStart: 0, rowSpan: 1, colSpan: 1 },
    { id: "cell-2", rowStart: 0, colStart: 1, rowSpan: 1, colSpan: 1 },
    { id: "cell-3", rowStart: 0, colStart: 2, rowSpan: 1, colSpan: 1 },
    { id: "cell-4", rowStart: 0, colStart: 3, rowSpan: 1, colSpan: 1 },
    { id: "cell-5", rowStart: 1, colStart: 0, rowSpan: 1, colSpan: 1 },
    { id: "cell-6", rowStart: 1, colStart: 1, rowSpan: 1, colSpan: 1 },
    { id: "cell-7", rowStart: 1, colStart: 2, rowSpan: 1, colSpan: 1 },
    { id: "cell-8", rowStart: 1, colStart: 3, rowSpan: 1, colSpan: 1 },
    { id: "cell-9", rowStart: 2, colStart: 0, rowSpan: 1, colSpan: 1 },
    { id: "cell-10", rowStart: 2, colStart: 1, rowSpan: 1, colSpan: 1 },
    { id: "cell-11", rowStart: 2, colStart: 2, rowSpan: 1, colSpan: 1 },
    { id: "cell-12", rowStart: 2, colStart: 3, rowSpan: 1, colSpan: 1 },
  ],
  colSizes: [25, 25, 25, 25],
  rowSizes: [33.33, 33.33, 33.34],
};

export const BASIC_4X4: LayoutDefinition = {
  id: "basic-4x4",
  name: "Basic 4×4",
  cells: [
    { id: "cell-1", rowStart: 0, colStart: 0, rowSpan: 1, colSpan: 1 },
    { id: "cell-2", rowStart: 0, colStart: 1, rowSpan: 1, colSpan: 1 },
    { id: "cell-3", rowStart: 0, colStart: 2, rowSpan: 1, colSpan: 1 },
    { id: "cell-4", rowStart: 0, colStart: 3, rowSpan: 1, colSpan: 1 },
    { id: "cell-5", rowStart: 1, colStart: 0, rowSpan: 1, colSpan: 1 },
    { id: "cell-6", rowStart: 1, colStart: 1, rowSpan: 1, colSpan: 1 },
    { id: "cell-7", rowStart: 1, colStart: 2, rowSpan: 1, colSpan: 1 },
    { id: "cell-8", rowStart: 1, colStart: 3, rowSpan: 1, colSpan: 1 },
    { id: "cell-9", rowStart: 2, colStart: 0, rowSpan: 1, colSpan: 1 },
    { id: "cell-10", rowStart: 2, colStart: 1, rowSpan: 1, colSpan: 1 },
    { id: "cell-11", rowStart: 2, colStart: 2, rowSpan: 1, colSpan: 1 },
    { id: "cell-12", rowStart: 2, colStart: 3, rowSpan: 1, colSpan: 1 },
    { id: "cell-13", rowStart: 3, colStart: 0, rowSpan: 1, colSpan: 1 },
    { id: "cell-14", rowStart: 3, colStart: 1, rowSpan: 1, colSpan: 1 },
    { id: "cell-15", rowStart: 3, colStart: 2, rowSpan: 1, colSpan: 1 },
    { id: "cell-16", rowStart: 3, colStart: 3, rowSpan: 1, colSpan: 1 },
  ],
  colSizes: [25, 25, 25, 25],
  rowSizes: [25, 25, 25, 25],
};

const TRACK_TOLERANCE = 0.05;

export function generateCellId(): string {
  cellCounter += 1;
  return `cell-${Date.now()}-${cellCounter}`;
}

export function createTiledCells(rowCount: number, colCount: number): LayoutCell[] {
  const cells: LayoutCell[] = [];
  for (let row = 0; row < rowCount; row += 1) {
    for (let col = 0; col < colCount; col += 1) {
      cells.push({
        id: generateCellId(),
        rowStart: row,
        colStart: col,
        rowSpan: 1,
        colSpan: 1,
      });
    }
  }
  return cells;
}

export function getCellSlotName(index: number): string {
  return `slot${index + 1}`;
}

export function getSortedCells(cells: LayoutCell[]): LayoutCell[] {
  return [...cells].sort((a, b) => {
    if (a.rowStart !== b.rowStart) return a.rowStart - b.rowStart;
    if (a.colStart !== b.colStart) return a.colStart - b.colStart;
    if (a.rowSpan !== b.rowSpan) return a.rowSpan - b.rowSpan;
    if (a.colSpan !== b.colSpan) return a.colSpan - b.colSpan;
    return a.id.localeCompare(b.id);
  });
}

export function getCellSlotMap(cells: LayoutCell[]): Map<string, string> {
  return new Map(getSortedCells(cells).map((cell, index) => [cell.id, getCellSlotName(index)]));
}

export function getGridDimensions(
  cells: LayoutCell[],
  options?: Partial<LayoutDimensions>
): LayoutDimensions {
  const inferredRows = Math.max(0, ...cells.map((cell) => cell.rowStart + cell.rowSpan));
  const inferredCols = Math.max(0, ...cells.map((cell) => cell.colStart + cell.colSpan));

  return {
    rowCount: Math.max(options?.rowCount ?? 0, inferredRows, 1),
    colCount: Math.max(options?.colCount ?? 0, inferredCols, 1),
  };
}

export function getLayoutDimensions(layout: LayoutDefinition): LayoutDimensions {
  const explicitRowCount = Math.max(
    layout.rowSizes?.length ?? 0,
    ...((layout.columnRowSizes ?? []).map((sizes) => sizes.length) ?? [0])
  );
  const explicitColCount = Math.max(
    layout.colSizes?.length ?? 0,
    layout.columnRowSizes?.length ?? 0
  );

  return getGridDimensions(layout.cells, {
    rowCount: explicitRowCount,
    colCount: explicitColCount,
  });
}

function normalizeTrackSizes(sizes: number[]): number[] {
  if (sizes.length === 0) return [];
  const rounded = sizes.map((size) => Number(size.toFixed(2)));
  const totalExceptLast = rounded.slice(0, -1).reduce((sum, size) => sum + size, 0);
  rounded[rounded.length - 1] = Number((100 - totalExceptLast).toFixed(2));
  return rounded;
}

function cloneTrackMatrix(matrix: number[][]): number[][] {
  return matrix.map((sizes) => [...sizes]);
}

function sumTrackRange(sizes: number[], start: number, end: number): number {
  return sizes.slice(start, end).reduce((sum, size) => sum + size, 0);
}

function normalizeTrackGroup(values: number[], targetTotal: number): number[] {
  if (values.length === 0) return [];
  if (targetTotal <= 0) return Array(values.length).fill(0);

  const rounded = values.map((value) => Number(value.toFixed(2)));
  const totalExceptLast = rounded.slice(0, -1).reduce((sum, value) => sum + value, 0);
  rounded[rounded.length - 1] = Number((targetTotal - totalExceptLast).toFixed(2));
  return rounded;
}

function range(start: number, end: number): number[] {
  return Array.from({ length: Math.max(0, end - start) }, (_, index) => start + index);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function createEqualTrackSizes(count: number): number[] {
  if (count <= 0) return [];
  const base = Number((100 / count).toFixed(2));
  return normalizeTrackSizes(Array.from({ length: count }, () => base));
}

export function createEqualColumnRowSizes(colCount: number, rowCount: number): number[][] {
  const fallback = createEqualTrackSizes(rowCount);
  return Array.from({ length: colCount }, () => [...fallback]);
}

function resolveTrackSizes(explicit: number[] | undefined, count: number): number[] {
  if (explicit && explicit.length === count) return normalizeTrackSizes(explicit);
  return createEqualTrackSizes(count);
}

export function summarizeColumnRowSizes(columnRowSizes: number[][]): number[] {
  if (columnRowSizes.length === 0) return [];
  const rowCount = Math.max(...columnRowSizes.map((sizes) => sizes.length), 0);
  if (rowCount <= 0) return [];

  const normalizedColumns = columnRowSizes
    .filter((sizes) => sizes.length === rowCount)
    .map((sizes) => normalizeTrackSizes(sizes));

  if (normalizedColumns.length === 0) {
    return createEqualTrackSizes(rowCount);
  }

  return normalizeTrackSizes(
    Array.from({ length: rowCount }, (_, rowIndex) =>
      average(normalizedColumns.map((sizes) => sizes[rowIndex] ?? 0))
    )
  );
}

export function resolveColSizes(layout: LayoutDefinition): number[] {
  return resolveTrackSizes(layout.colSizes, getLayoutDimensions(layout).colCount);
}

export function resolveRowSizes(layout: LayoutDefinition): number[] {
  const rowCount = getLayoutDimensions(layout).rowCount;
  if (layout.rowSizes && layout.rowSizes.length === rowCount) {
    return normalizeTrackSizes(layout.rowSizes);
  }

  const explicitColumnRows = layout.columnRowSizes;
  if (explicitColumnRows && explicitColumnRows.length > 0) {
    const summary = summarizeColumnRowSizes(explicitColumnRows);
    if (summary.length === rowCount) return summary;
  }

  return createEqualTrackSizes(rowCount);
}

export function normalizeColumnRowSizes(
  columnRowSizes: number[][] | undefined,
  colCount: number,
  rowCount: number,
  fallbackRowSizes?: number[]
): number[][] {
  const fallback = resolveTrackSizes(fallbackRowSizes, rowCount);
  return Array.from({ length: colCount }, (_, colIndex) => {
    const candidate = columnRowSizes?.[colIndex];
    if (candidate && candidate.length === rowCount) return normalizeTrackSizes(candidate);
    return [...fallback];
  });
}

export function resolveColumnRowSizes(layout: LayoutDefinition): number[][] {
  const { colCount, rowCount } = getLayoutDimensions(layout);
  const getFallback = () => {
    if (layout.rowSizes && layout.rowSizes.length === rowCount)
      return normalizeTrackSizes(layout.rowSizes);
    if (layout.columnRowSizes && layout.columnRowSizes.length > 0)
      return summarizeColumnRowSizes(layout.columnRowSizes);
    return createEqualTrackSizes(rowCount);
  };
  const fallback = getFallback();

  return normalizeColumnRowSizes(layout.columnRowSizes, colCount, rowCount, fallback);
}

export function buildTrackOffsets(sizes: number[], total = 100): number[] {
  const offsets = [0];
  let sum = 0;
  for (const size of sizes) {
    sum += (size / 100) * total;
    offsets.push(Number(sum.toFixed(4)));
  }
  return offsets;
}

function getBoundaryOffset(sizes: number[], boundaryIndex: number): number {
  return buildTrackOffsets(sizes)[boundaryIndex] ?? 0;
}

function setTrackBoundary(sizes: number[], boundaryIndex: number, targetOffset: number): number[] {
  if (boundaryIndex <= 0 || boundaryIndex >= sizes.length) return sizes;

  const offsets = buildTrackOffsets(sizes);
  const previous = offsets[boundaryIndex - 1] ?? 0;
  const next = offsets[boundaryIndex + 1] ?? 100;
  const clamped = Math.min(Math.max(targetOffset, previous), next);

  const nextSizes = [...sizes];
  nextSizes[boundaryIndex - 1] = Number((clamped - previous).toFixed(2));
  nextSizes[boundaryIndex] = Number((next - clamped).toFixed(2));
  return normalizeTrackSizes(nextSizes);
}

function buildOccupationGrid(
  cells: LayoutCell[],
  rowCount: number,
  colCount: number
): (string | null)[][] | null {
  const grid: (string | null)[][] = Array.from({ length: rowCount }, () =>
    Array(colCount).fill(null)
  );

  for (const cell of cells) {
    if (!placeCellInOccupationGrid(grid, cell, rowCount, colCount)) {
      return null;
    }
  }

  return grid;
}

export function validateGrid(cells: LayoutCell[], dimensions?: Partial<LayoutDimensions>): boolean {
  const { rowCount, colCount } = getGridDimensions(cells, dimensions);
  const grid = buildOccupationGrid(cells, rowCount, colCount);
  return grid?.every((row) => row.every((cellId) => cellId !== null)) ?? false;
}

export function validateSpanningCellAlignment(
  layout: LayoutDefinition,
  tolerance = TRACK_TOLERANCE
): boolean {
  const columnRowSizes = resolveColumnRowSizes(layout);
  const { rowCount } = getLayoutDimensions(layout);

  return layout.cells.every((cell) => {
    if (cell.colSpan <= 1) return true;

    const columns = range(cell.colStart, cell.colStart + cell.colSpan);
    const topBoundary = cell.rowStart;
    const bottomBoundary = cell.rowStart + cell.rowSpan;

    if (topBoundary > 0 && topBoundary < rowCount) {
      const offsets = columns.map((colIndex) =>
        getBoundaryOffset(columnRowSizes[colIndex] ?? [], topBoundary)
      );
      if (Math.max(...offsets) - Math.min(...offsets) > tolerance) return false;
    }

    if (bottomBoundary > 0 && bottomBoundary < rowCount) {
      const offsets = columns.map((colIndex) =>
        getBoundaryOffset(columnRowSizes[colIndex] ?? [], bottomBoundary)
      );
      if (Math.max(...offsets) - Math.min(...offsets) > tolerance) return false;
    }

    return true;
  });
}

export function normalizeSpanningCellBoundaries(layout: LayoutDefinition): LayoutDefinition {
  const { rowCount } = getLayoutDimensions(layout);
  const columnRowSizes = cloneTrackMatrix(resolveColumnRowSizes(layout));

  for (const cell of getSortedCells(layout.cells)) {
    if (cell.colSpan <= 1) continue;

    const columns = range(cell.colStart, cell.colStart + cell.colSpan);
    const topBoundary = cell.rowStart;
    const bottomBoundary = cell.rowStart + cell.rowSpan;

    if (topBoundary > 0 && topBoundary < rowCount) {
      alignBoundaryAcrossColumns(columnRowSizes, columns, topBoundary);
    }

    if (bottomBoundary > 0 && bottomBoundary < rowCount) {
      alignBoundaryAcrossColumns(columnRowSizes, columns, bottomBoundary);
    }
  }

  return {
    ...layout,
    columnRowSizes,
    rowSizes: summarizeColumnRowSizes(columnRowSizes),
  };
}

export function canMerge(a: LayoutCell, b: LayoutCell): boolean {
  if (a.rowStart === b.rowStart && a.rowSpan === b.rowSpan) {
    if (a.colStart + a.colSpan === b.colStart) return true;
    if (b.colStart + b.colSpan === a.colStart) return true;
  }

  if (a.colStart === b.colStart && a.colSpan === b.colSpan) {
    if (a.rowStart + a.rowSpan === b.rowStart) return true;
    if (b.rowStart + b.rowSpan === a.rowStart) return true;
  }

  return false;
}

export function mergeCells(cells: LayoutCell[], aId: string, bId: string): LayoutCell[] {
  const a = cells.find((cell) => cell.id === aId);
  const b = cells.find((cell) => cell.id === bId);
  if (!a || !b) return cells;

  const merged: LayoutCell = {
    id: generateCellId(),
    rowStart: Math.min(a.rowStart, b.rowStart),
    colStart: Math.min(a.colStart, b.colStart),
    rowSpan:
      Math.max(a.rowStart + a.rowSpan, b.rowStart + b.rowSpan) - Math.min(a.rowStart, b.rowStart),
    colSpan:
      Math.max(a.colStart + a.colSpan, b.colStart + b.colSpan) - Math.min(a.colStart, b.colStart),
  };

  return [...cells.filter((cell) => cell.id !== aId && cell.id !== bId), merged];
}

export interface SplitLine {
  axis: "horizontal" | "vertical";
  position: number;
}

export function getSplitLines(cell: LayoutCell): SplitLine[] {
  const lines: SplitLine[] = [];

  for (let offset = 1; offset < cell.rowSpan; offset += 1) {
    lines.push({ axis: "horizontal", position: cell.rowStart + offset });
  }

  for (let offset = 1; offset < cell.colSpan; offset += 1) {
    lines.push({ axis: "vertical", position: cell.colStart + offset });
  }

  return lines;
}

export function splitCell(cells: LayoutCell[], cellId: string, line: SplitLine): LayoutCell[] {
  const cell = cells.find((candidate) => candidate.id === cellId);
  if (!cell) return cells;

  if (line.axis === "horizontal") {
    const topRowSpan = line.position - cell.rowStart;
    const bottomRowSpan = cell.rowSpan - topRowSpan;
    return [
      ...cells.filter((candidate) => candidate.id !== cellId),
      {
        id: generateCellId(),
        rowStart: cell.rowStart,
        colStart: cell.colStart,
        rowSpan: topRowSpan,
        colSpan: cell.colSpan,
      },
      {
        id: generateCellId(),
        rowStart: line.position,
        colStart: cell.colStart,
        rowSpan: bottomRowSpan,
        colSpan: cell.colSpan,
      },
    ];
  }

  const leftColSpan = line.position - cell.colStart;
  const rightColSpan = cell.colSpan - leftColSpan;

  return [
    ...cells.filter((candidate) => candidate.id !== cellId),
    {
      id: generateCellId(),
      rowStart: cell.rowStart,
      colStart: cell.colStart,
      rowSpan: cell.rowSpan,
      colSpan: leftColSpan,
    },
    {
      id: generateCellId(),
      rowStart: cell.rowStart,
      colStart: line.position,
      rowSpan: cell.rowSpan,
      colSpan: rightColSpan,
    },
  ];
}

export function getGridAreaName(id: string): string {
  return `area_${id.replace(/[^a-zA-Z0-9_]/g, "_")}`;
}

function generateAreaMatrix(
  cells: LayoutCell[],
  dimensions: LayoutDimensions,
  getAreaName: (cell: LayoutCell) => string
): string[][] {
  const grid = Array.from({ length: dimensions.rowCount }, () =>
    Array(dimensions.colCount).fill(".")
  );

  for (const cell of cells) {
    const areaName = getAreaName(cell);
    for (let row = cell.rowStart; row < cell.rowStart + cell.rowSpan; row += 1) {
      for (let col = cell.colStart; col < cell.colStart + cell.colSpan; col += 1) {
        const targetRow = grid[row];
        if (targetRow) targetRow[col] = areaName;
      }
    }
  }

  return grid;
}

function matrixToTemplateAreas(matrix: string[][]): string {
  return matrix.map((row) => `"${row.join(" ")}"`).join(" ");
}

export function generateGridTemplateAreas(layout: LayoutDefinition): string {
  return matrixToTemplateAreas(
    generateAreaMatrix(layout.cells, getLayoutDimensions(layout), (cell) =>
      getGridAreaName(cell.id)
    )
  );
}

export function generateSlottedGridAreas(
  cells: LayoutCell[],
  dimensions?: Partial<LayoutDimensions>
): string {
  const slotNames = getCellSlotMap(cells);
  return matrixToTemplateAreas(
    generateAreaMatrix(
      cells,
      getGridDimensions(cells, dimensions),
      (cell) => slotNames.get(cell.id) ?? "."
    )
  );
}

export function generateStackedGridAreas(areaNames: string[], columns: number): string {
  if (columns <= 0) return "";

  const rows: string[][] = [];
  for (let index = 0; index < areaNames.length; index += columns) {
    const row = areaNames.slice(index, index + columns);
    while (row.length < columns) row.push(".");
    rows.push(row);
  }

  return matrixToTemplateAreas(rows);
}

export function getCellAt(cells: LayoutCell[], row: number, col: number): LayoutCell | null {
  return (
    cells.find(
      (cell) =>
        row >= cell.rowStart &&
        row < cell.rowStart + cell.rowSpan &&
        col >= cell.colStart &&
        col < cell.colStart + cell.colSpan
    ) ?? null
  );
}

function insertTrackSizes(sizes: number[], position: number): number[] {
  if (sizes.length === 0) return [100];

  const getTargetIndex = () => {
    if (position <= 0) return 0;
    if (position >= sizes.length) return sizes.length - 1;
    return position - 1;
  };
  const targetIndex = getTargetIndex();
  const original = sizes[targetIndex] ?? 0;
  const first = Number((original / 2).toFixed(2));
  const second = Number((original - first).toFixed(2));

  const next = [...sizes];
  next.splice(targetIndex, 1, first, second);
  return normalizeTrackSizes(next);
}

function removeTrackSizes(sizes: number[], index: number): number[] {
  if (sizes.length <= 1) return sizes;

  const next = [...sizes];
  const removed = next[index] ?? 0;
  next.splice(index, 1);

  if (next.length === 0) return [];
  if (index === 0) next[0] = (next[0] ?? 0) + removed;
  else next[index - 1] = (next[index - 1] ?? 0) + removed;

  return normalizeTrackSizes(next);
}

function insertColumnProfiles(layout: LayoutDefinition, position: number): number[][] {
  const { colCount, rowCount } = getLayoutDimensions(layout);
  const current = resolveColumnRowSizes(layout);
  const getInsertIndex = () => {
    if (position <= 0) return 0;
    if (position >= colCount) return colCount;
    return position;
  };
  const insertIndex = getInsertIndex();
  const getSourceIndex = () => {
    if (position <= 0) return 0;
    if (position >= colCount) return Math.max(colCount - 1, 0);
    return Math.max(position - 1, 0);
  };
  const sourceIndex = getSourceIndex();
  const seed = current[sourceIndex] ? [...current[sourceIndex]] : createEqualTrackSizes(rowCount);
  const next = cloneTrackMatrix(current);
  next.splice(insertIndex, 0, seed);
  return next;
}

function removeColumnProfiles(layout: LayoutDefinition, index: number): number[][] {
  const current = cloneTrackMatrix(resolveColumnRowSizes(layout));
  if (current.length <= 1) return current;
  current.splice(index, 1);
  return current;
}

function insertRowProfiles(layout: LayoutDefinition, position: number): number[][] {
  return resolveColumnRowSizes(layout).map((sizes) => insertTrackSizes(sizes, position));
}

function removeRowProfiles(layout: LayoutDefinition, index: number): number[][] {
  return resolveColumnRowSizes(layout).map((sizes) => removeTrackSizes(sizes, index));
}

function fillGaps(cells: LayoutCell[], dimensions: LayoutDimensions): LayoutCell[] {
  const grid = buildOccupationGrid(cells, dimensions.rowCount, dimensions.colCount);
  if (!grid) return cells;

  const next = [...cells];
  for (let row = 0; row < dimensions.rowCount; row += 1) {
    for (let col = 0; col < dimensions.colCount; col += 1) {
      if (grid[row]?.[col]) continue;
      next.push({
        id: generateCellId(),
        rowStart: row,
        colStart: col,
        rowSpan: 1,
        colSpan: 1,
      });
    }
  }
  return next;
}

type TrackAxis = "row" | "col";

function insertTrack(layout: LayoutDefinition, axis: TrackAxis, position: number): TrackEditResult {
  const dimensions = getLayoutDimensions(layout);
  const nextCells = layout.cells.map((cell) => {
    if (axis === "col") {
      const end = cell.colStart + cell.colSpan;
      if (cell.colStart >= position) return { ...cell, colStart: cell.colStart + 1 };
      if (position > cell.colStart && position < end) return { ...cell, colSpan: cell.colSpan + 1 };
      return { ...cell };
    }

    const end = cell.rowStart + cell.rowSpan;
    if (cell.rowStart >= position) return { ...cell, rowStart: cell.rowStart + 1 };
    if (position > cell.rowStart && position < end) return { ...cell, rowSpan: cell.rowSpan + 1 };
    return { ...cell };
  });

  const nextDimensions =
    axis === "col"
      ? { rowCount: dimensions.rowCount, colCount: dimensions.colCount + 1 }
      : { rowCount: dimensions.rowCount + 1, colCount: dimensions.colCount };

  const nextColumnRowSizes =
    axis === "col" ? insertColumnProfiles(layout, position) : insertRowProfiles(layout, position);

  return {
    removedCellIds: [],
    layout: normalizeSpanningCellBoundaries({
      ...layout,
      cells: fillGaps(nextCells, nextDimensions),
      colSizes:
        axis === "col"
          ? insertTrackSizes(resolveColSizes(layout), position)
          : resolveColSizes(layout),
      rowSizes:
        axis === "row"
          ? insertTrackSizes(resolveRowSizes(layout), position)
          : summarizeColumnRowSizes(nextColumnRowSizes),
      columnRowSizes: nextColumnRowSizes,
    }),
  };
}

function removeTrack(layout: LayoutDefinition, axis: TrackAxis, index: number): TrackEditResult {
  const dimensions = getLayoutDimensions(layout);
  const maxTracks = axis === "col" ? dimensions.colCount : dimensions.rowCount;
  if (maxTracks <= 1) {
    return { layout, removedCellIds: [] };
  }

  const removedCellIds: string[] = [];
  const nextCells: LayoutCell[] = [];

  for (const cell of layout.cells) {
    const result =
      axis === "col" ? removeColumnTrackFromCell(cell, index) : removeRowTrackFromCell(cell, index);

    if (result.removedCellId) {
      removedCellIds.push(result.removedCellId);
      continue;
    }

    if (result.cell) {
      nextCells.push(result.cell);
    }
  }

  const nextColumnRowSizes =
    axis === "col" ? removeColumnProfiles(layout, index) : removeRowProfiles(layout, index);

  return {
    removedCellIds,
    layout: normalizeSpanningCellBoundaries({
      ...layout,
      cells: nextCells,
      colSizes:
        axis === "col" ? removeTrackSizes(resolveColSizes(layout), index) : resolveColSizes(layout),
      rowSizes:
        axis === "row"
          ? removeTrackSizes(resolveRowSizes(layout), index)
          : summarizeColumnRowSizes(nextColumnRowSizes),
      columnRowSizes: nextColumnRowSizes,
    }),
  };
}

export function insertColumn(layout: LayoutDefinition, position: number): TrackEditResult {
  return insertTrack(layout, "col", position);
}

export function insertRow(layout: LayoutDefinition, position: number): TrackEditResult {
  return insertTrack(layout, "row", position);
}

export function removeColumn(layout: LayoutDefinition, index: number): TrackEditResult {
  return removeTrack(layout, "col", index);
}

export function removeRow(layout: LayoutDefinition, index: number): TrackEditResult {
  return removeTrack(layout, "row", index);
}

export function sizesToGridTemplate(sizes: number[]): string {
  return sizes.map((size) => `${size}fr`).join(" ");
}

export function applyResizeDelta(
  sizes: number[],
  index: number,
  delta: number,
  minPct = 10
): number[] {
  if (index < 0 || index >= sizes.length - 1) return sizes;

  const next = [...sizes];
  const currentA = next[index] ?? 0;
  const currentB = next[index + 1] ?? 0;
  const newA = currentA + delta;
  const newB = currentB - delta;

  if (newA < minPct || newB < minPct) return sizes;

  next[index] = newA;
  next[index + 1] = newB;
  return normalizeTrackSizes(next);
}

export function applyColumnBoundaryDelta(
  layout: LayoutDefinition,
  columns: number[],
  row: number,
  delta: number,
  minPct = 10
): number[][] {
  const currentColumnRowSizes = resolveColumnRowSizes(layout);
  const next = cloneTrackMatrix(currentColumnRowSizes);

  for (const colIndex of columns) {
    const above = getCellAt(layout.cells, row - 1, colIndex);
    const below = getCellAt(layout.cells, row, colIndex);
    const current = next[colIndex];
    if (!above || !below || above.id === below.id || !current) return currentColumnRowSizes;

    const topStart = above.rowStart;
    const bottomEnd = below.rowStart + below.rowSpan;
    const topTotal = sumTrackRange(current, topStart, row);
    const bottomTotal = sumTrackRange(current, row, bottomEnd);
    const nextTopTotal = Number((topTotal + delta).toFixed(2));
    const nextBottomTotal = Number((bottomTotal - delta).toFixed(2));

    if (nextTopTotal < minPct || nextBottomTotal < minPct) {
      return currentColumnRowSizes;
    }

    const topSlice = current.slice(topStart, row);
    const bottomSlice = current.slice(row, bottomEnd);
    const scaledTop =
      topTotal > 0
        ? topSlice.map((value) => (value / topTotal) * nextTopTotal)
        : Array.from({ length: topSlice.length }, () => nextTopTotal / topSlice.length);
    const scaledBottom =
      bottomTotal > 0
        ? bottomSlice.map((value) => (value / bottomTotal) * nextBottomTotal)
        : Array.from({ length: bottomSlice.length }, () => nextBottomTotal / bottomSlice.length);
    const updated = [...current];

    updated.splice(topStart, topSlice.length, ...normalizeTrackGroup(scaledTop, nextTopTotal));
    updated.splice(row, bottomSlice.length, ...normalizeTrackGroup(scaledBottom, nextBottomTotal));

    const changed =
      updated.length !== current.length ||
      updated.some((value, valueIndex) => value !== current[valueIndex]);
    if (!changed && delta !== 0) return currentColumnRowSizes;
    next[colIndex] = updated;
  }

  return next;
}

export function getCellRect(layout: LayoutDefinition, cell: LayoutCell): LayoutCellRect {
  const colOffsets = buildTrackOffsets(resolveColSizes(layout));
  const rowOffsetsByColumn = resolveColumnRowSizes(layout).map((sizes) => buildTrackOffsets(sizes));
  const columns = range(cell.colStart, cell.colStart + cell.colSpan);
  const topValues = columns.map((colIndex) => rowOffsetsByColumn[colIndex]?.[cell.rowStart] ?? 0);
  const bottomValues = columns.map(
    (colIndex) => rowOffsetsByColumn[colIndex]?.[cell.rowStart + cell.rowSpan] ?? 100
  );

  const leftPct = colOffsets[cell.colStart] ?? 0;
  const rightPct = colOffsets[cell.colStart + cell.colSpan] ?? 100;
  const topPct = average(topValues);
  const bottomPct = average(bottomValues);

  return {
    leftPct,
    topPct,
    widthPct: rightPct - leftPct,
    heightPct: bottomPct - topPct,
  };
}

export function getHorizontalResizeHandles(
  layout: LayoutDefinition
): HorizontalResizeHandleDescriptor[] {
  const { rowCount, colCount } = getLayoutDimensions(layout);
  const colOffsets = buildTrackOffsets(resolveColSizes(layout));
  const rowOffsetsByColumn = resolveColumnRowSizes(layout).map((sizes) => buildTrackOffsets(sizes));
  const handles: HorizontalResizeHandleDescriptor[] = [];
  const seen = new Set<string>();

  for (let row = 1; row < rowCount; row += 1) {
    for (let col = 0; col < colCount; col += 1) {
      const handle = getHorizontalResizeHandleAt(
        layout,
        row,
        col,
        { rowCount, colCount },
        colOffsets,
        rowOffsetsByColumn
      );
      if (!handle || seen.has(handle.id)) continue;
      handles.push(handle);
      seen.add(handle.id);
    }
  }

  return handles;
}

function placeCellInOccupationGrid(
  grid: (string | null)[][],
  cell: LayoutCell,
  rowCount: number,
  colCount: number
): boolean {
  for (let row = cell.rowStart; row < cell.rowStart + cell.rowSpan; row += 1) {
    for (let col = cell.colStart; col < cell.colStart + cell.colSpan; col += 1) {
      if (row < 0 || row >= rowCount || col < 0 || col >= colCount) return false;

      const targetRow = grid[row];
      if (!targetRow || targetRow[col]) return false;
      targetRow[col] = cell.id;
    }
  }

  return true;
}

function alignBoundaryAcrossColumns(
  columnRowSizes: number[][],
  columns: number[],
  boundary: number
): void {
  const target = average(
    columns.map((colIndex) => getBoundaryOffset(columnRowSizes[colIndex] ?? [], boundary))
  );

  for (const colIndex of columns) {
    const sizes = columnRowSizes[colIndex];
    if (!sizes) continue;
    columnRowSizes[colIndex] = setTrackBoundary(sizes, boundary, target);
  }
}

function removeColumnTrackFromCell(
  cell: LayoutCell,
  index: number
): { cell?: LayoutCell; removedCellId?: string } {
  const end = cell.colStart + cell.colSpan;
  if (cell.colStart > index) {
    return { cell: { ...cell, colStart: cell.colStart - 1 } };
  }

  if (index < cell.colStart || index >= end) {
    return { cell: { ...cell } };
  }

  if (cell.colSpan === 1) {
    return { removedCellId: cell.id };
  }

  return { cell: { ...cell, colSpan: cell.colSpan - 1 } };
}

function removeRowTrackFromCell(
  cell: LayoutCell,
  index: number
): { cell?: LayoutCell; removedCellId?: string } {
  const end = cell.rowStart + cell.rowSpan;
  if (cell.rowStart > index) {
    return { cell: { ...cell, rowStart: cell.rowStart - 1 } };
  }

  if (index < cell.rowStart || index >= end) {
    return { cell: { ...cell } };
  }

  if (cell.rowSpan === 1) {
    return { removedCellId: cell.id };
  }

  return { cell: { ...cell, rowSpan: cell.rowSpan - 1 } };
}

function getHorizontalHandleBounds(pair: [LayoutCell, LayoutCell]): {
  id: string;
  colStart: number;
  colEnd: number;
} {
  const [above, below] = pair;
  const colStart = Math.min(above.colStart, below.colStart);
  const colEnd = Math.max(above.colStart + above.colSpan, below.colStart + below.colSpan);

  return {
    id: `row-${above.rowStart + above.rowSpan}-cols-${colStart}-${colEnd}`,
    colStart,
    colEnd,
  };
}

function collectHorizontalHandleOffsets(
  layout: LayoutDefinition,
  row: number,
  colStart: number,
  colEnd: number,
  dimensions: LayoutDimensions,
  rowOffsetsByColumn: number[][]
): number[] | null {
  const offsets: number[] = [];

  for (let groupedCol = colStart; groupedCol < colEnd; groupedCol += 1) {
    const groupedPair = getCellsAtBorder(layout.cells, "horizontal", row, groupedCol, dimensions);
    if (!groupedPair) {
      return null;
    }

    const { colStart: groupStart, colEnd: groupEnd } = getHorizontalHandleBounds(groupedPair);
    if (groupStart !== colStart || groupEnd !== colEnd) {
      return null;
    }

    offsets.push(rowOffsetsByColumn[groupedCol]?.[row] ?? 0);
  }

  return offsets;
}

function getHorizontalResizeHandleAt(
  layout: LayoutDefinition,
  row: number,
  col: number,
  dimensions: LayoutDimensions,
  colOffsets: number[],
  rowOffsetsByColumn: number[][]
): HorizontalResizeHandleDescriptor | null {
  const pair = getCellsAtBorder(layout.cells, "horizontal", row, col, dimensions);
  if (!pair) return null;

  const { id, colStart, colEnd } = getHorizontalHandleBounds(pair);
  const offsets = collectHorizontalHandleOffsets(
    layout,
    row,
    colStart,
    colEnd,
    dimensions,
    rowOffsetsByColumn
  );
  if (!offsets) return null;
  if (Math.max(...offsets) - Math.min(...offsets) > TRACK_TOLERANCE) return null;

  const leftPct = colOffsets[colStart] ?? 0;
  const rightPct = colOffsets[colEnd] ?? 100;
  return {
    id,
    row,
    colStart,
    colSpan: colEnd - colStart,
    columns: range(colStart, colEnd),
    leftPct,
    topPct: average(offsets),
    widthPct: rightPct - leftPct,
  };
}

export function getCellsAtBorder(
  cells: LayoutCell[],
  axis: "horizontal" | "vertical",
  row: number,
  col: number,
  dimensions?: Partial<LayoutDimensions>
): [LayoutCell, LayoutCell] | null {
  const resolvedDimensions = getGridDimensions(cells, dimensions);

  if (axis === "horizontal") {
    if (row <= 0 || row >= resolvedDimensions.rowCount) return null;
    const above = getCellAt(cells, row - 1, col);
    const below = getCellAt(cells, row, col);
    if (!above || !below || above.id === below.id) return null;
    return [above, below];
  }

  if (col <= 0 || col >= resolvedDimensions.colCount) return null;
  const left = getCellAt(cells, row, col - 1);
  const right = getCellAt(cells, row, col);
  if (!left || !right || left.id === right.id) return null;
  return [left, right];
}
