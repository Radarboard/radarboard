export interface ParsedSelectionValue {
  selectionId: string;
  itemKey: string;
}

export function encodeSelectionValue(selectionId: string, itemKey: string): string {
  return `${selectionId}:${itemKey}`;
}

export function parseSelectionValue(value: string | null | undefined): ParsedSelectionValue | null {
  if (!value) return null;

  const separatorIndex = value.indexOf(":");
  if (separatorIndex <= 0 || separatorIndex === value.length - 1) {
    return null;
  }

  return {
    selectionId: value.slice(0, separatorIndex),
    itemKey: value.slice(separatorIndex + 1),
  };
}
