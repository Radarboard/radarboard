import type { LayoutDefinition } from "@radarboard/types/database";
import { describe, expect, it } from "vitest";
import {
  applyColumnBoundaryDelta,
  BASIC_3X3,
  BASIC_4X3,
  BASIC_4X4,
  createEqualTrackSizes,
  createTiledCells,
  getHorizontalResizeHandles,
  getSortedCells,
  insertColumn,
  mergeCells,
  normalizeSpanningCellBoundaries,
  removeColumn,
  resolveColumnRowSizes,
  splitCell,
  validateGrid,
  validateSpanningCellAlignment,
} from "./";

function createLayout(rowCount: number, colCount: number): LayoutDefinition {
  return {
    id: `layout-${rowCount}x${colCount}`,
    name: `${rowCount}x${colCount}`,
    cells: createTiledCells(rowCount, colCount),
    colSizes: createEqualTrackSizes(colCount),
    rowSizes: createEqualTrackSizes(rowCount),
  };
}

describe("layouts", () => {
  it("keeps the built-in 3x3 layout cell IDs stable", () => {
    expect(BASIC_3X3.cells[0]?.id).toBe("cell-1");
    expect(BASIC_3X3.cells[8]?.id).toBe("cell-9");
  });

  it("BASIC_4X3 has 12 cells in a valid 4-col 3-row grid", () => {
    expect(BASIC_4X3.cells).toHaveLength(12);
    expect(BASIC_4X3.cells[0]?.id).toBe("cell-1");
    expect(BASIC_4X3.cells[11]?.id).toBe("cell-12");
    expect(BASIC_4X3.colSizes).toEqual([25, 25, 25, 25]);
    expect(BASIC_4X3.rowSizes).toEqual([33.33, 33.33, 33.34]);
    expect(validateGrid(BASIC_4X3.cells, { rowCount: 3, colCount: 4 })).toBe(true);
  });

  it("BASIC_4X4 has 16 cells in a valid 4-col 4-row grid", () => {
    expect(BASIC_4X4.cells).toHaveLength(16);
    expect(BASIC_4X4.cells[0]?.id).toBe("cell-1");
    expect(BASIC_4X4.cells[15]?.id).toBe("cell-16");
    expect(BASIC_4X4.colSizes).toEqual([25, 25, 25, 25]);
    expect(BASIC_4X4.rowSizes).toEqual([25, 25, 25, 25]);
    expect(validateGrid(BASIC_4X4.cells, { rowCount: 4, colCount: 4 })).toBe(true);
  });

  it("validates tiled grids with arbitrary dimensions", () => {
    expect(validateGrid(createTiledCells(2, 4), { rowCount: 2, colCount: 4 })).toBe(true);
    expect(validateGrid(createTiledCells(5, 2), { rowCount: 5, colCount: 2 })).toBe(true);
  });

  it("preserves existing cell ids when inserting a column", () => {
    const layout = createLayout(2, 2);
    const originalIds = layout.cells.map((cell) => cell.id);

    const result = insertColumn(layout, 1);

    expect(validateGrid(result.layout.cells, { rowCount: 2, colCount: 3 })).toBe(true);
    expect(result.removedCellIds).toEqual([]);
    for (const id of originalIds) {
      expect(result.layout.cells.some((cell) => cell.id === id)).toBe(true);
    }
    expect(result.layout.cells).toHaveLength(6);
  });

  it("reports only removed cell ids when deleting a column", () => {
    const layout = createLayout(2, 3);
    const sorted = getSortedCells(layout.cells);

    const result = removeColumn(layout, 1);

    expect(validateGrid(result.layout.cells, { rowCount: 2, colCount: 2 })).toBe(true);
    expect(result.removedCellIds).toEqual([sorted[1]?.id, sorted[4]?.id]);
    expect(result.layout.cells.some((cell) => cell.id === sorted[0]?.id)).toBe(true);
    expect(result.layout.cells.some((cell) => cell.id === sorted[2]?.id)).toBe(true);
  });

  it("keeps the grid valid after merge and split on larger layouts", () => {
    const layout = createLayout(4, 2);
    const sorted = getSortedCells(layout.cells);
    const merged = mergeCells(layout.cells, sorted[0]?.id ?? "", sorted[2]?.id ?? "");
    expect(validateGrid(merged, { rowCount: 4, colCount: 2 })).toBe(true);

    const mergedCell = merged.find((cell) => cell.rowStart === 0 && cell.colStart === 0);
    expect(mergedCell).toBeDefined();

    const split = splitCell(merged, mergedCell?.id ?? "", {
      axis: "horizontal",
      position: 1,
    });
    expect(validateGrid(split, { rowCount: 4, colCount: 2 })).toBe(true);
  });

  it("derives per-column row sizes from legacy rowSizes", () => {
    const layout = createLayout(3, 2);

    expect(resolveColumnRowSizes(layout)).toEqual([
      [33.33, 33.33, 33.34],
      [33.33, 33.33, 33.34],
    ]);
  });

  it("only resizes the targeted columns for a horizontal boundary drag", () => {
    const layout: LayoutDefinition = {
      id: "resize-targeted-columns",
      name: "Resize targeted columns",
      cells: [
        { id: "a", rowStart: 0, colStart: 0, rowSpan: 1, colSpan: 1 },
        { id: "b", rowStart: 1, colStart: 0, rowSpan: 1, colSpan: 1 },
        { id: "c", rowStart: 2, colStart: 0, rowSpan: 1, colSpan: 1 },
        { id: "d", rowStart: 0, colStart: 1, rowSpan: 1, colSpan: 1 },
        { id: "e", rowStart: 1, colStart: 1, rowSpan: 1, colSpan: 1 },
        { id: "f", rowStart: 2, colStart: 1, rowSpan: 1, colSpan: 1 },
        { id: "g", rowStart: 0, colStart: 2, rowSpan: 1, colSpan: 1 },
        { id: "h", rowStart: 1, colStart: 2, rowSpan: 1, colSpan: 1 },
        { id: "i", rowStart: 2, colStart: 2, rowSpan: 1, colSpan: 1 },
      ],
      colSizes: [33.33, 33.33, 33.34],
      columnRowSizes: [
        [30, 30, 40],
        [20, 20, 60],
        [25, 25, 50],
      ],
    };

    const next = applyColumnBoundaryDelta(layout, [1], 1, 5);

    expect(next).toEqual([
      [30, 30, 40],
      [25, 15, 60],
      [25, 25, 50],
    ]);
  });

  it("resizes a merged region as a single block", () => {
    const layout: LayoutDefinition = {
      id: "merged-column",
      name: "Merged column",
      cells: [
        { id: "hero", rowStart: 0, colStart: 0, rowSpan: 2, colSpan: 1 },
        { id: "tail", rowStart: 2, colStart: 0, rowSpan: 1, colSpan: 1 },
      ],
      colSizes: [100],
      columnRowSizes: [[30, 30, 40]],
    };

    expect(applyColumnBoundaryDelta(layout, [0], 2, 5)).toEqual([[32.5, 32.5, 35]]);
  });

  it("normalizes spanning-cell boundaries across columns", () => {
    const layout: LayoutDefinition = {
      id: "spanning",
      name: "Spanning",
      cells: [
        { id: "hero", rowStart: 0, colStart: 0, rowSpan: 1, colSpan: 2 },
        { id: "left", rowStart: 1, colStart: 0, rowSpan: 2, colSpan: 1 },
        { id: "right", rowStart: 1, colStart: 1, rowSpan: 2, colSpan: 1 },
      ],
      colSizes: [50, 50],
      columnRowSizes: [
        [20, 30, 50],
        [30, 20, 50],
      ],
    };

    expect(validateSpanningCellAlignment(layout)).toBe(false);

    const normalized = normalizeSpanningCellBoundaries(layout);

    expect(validateSpanningCellAlignment(normalized)).toBe(true);
    expect(resolveColumnRowSizes(normalized)).toEqual([
      [25, 25, 50],
      [25, 25, 50],
    ]);
  });

  it("groups horizontal resize handles across spanning cells", () => {
    const layout: LayoutDefinition = {
      id: "spanning",
      name: "Spanning",
      cells: [
        { id: "hero", rowStart: 0, colStart: 0, rowSpan: 1, colSpan: 2 },
        { id: "left", rowStart: 1, colStart: 0, rowSpan: 1, colSpan: 1 },
        { id: "right", rowStart: 1, colStart: 1, rowSpan: 1, colSpan: 1 },
      ],
      colSizes: [50, 50],
      columnRowSizes: [
        [40, 60],
        [40, 60],
      ],
    };

    expect(getHorizontalResizeHandles(layout)).toEqual([
      expect.objectContaining({
        row: 1,
        colStart: 0,
        colSpan: 2,
        columns: [0, 1],
      }),
    ]);
  });
});
