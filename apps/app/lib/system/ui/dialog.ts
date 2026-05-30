import { isTauri } from "@/lib/platform";

interface OpenFileOptions {
  /** File extensions without the dot, e.g. ["json"] */
  extensions?: string[];
  /** Human-readable filter name, e.g. "JSON Files" */
  filterName?: string;
}

interface SaveFileOptions {
  /** Suggested file name */
  defaultName?: string;
  /** File extensions without the dot */
  extensions?: string[];
  /** Human-readable filter name */
  filterName?: string;
}

type SavePickerWindow = Window & {
  showOpenFilePicker?: (options?: {
    multiple?: boolean;
    excludeAcceptAllOption?: boolean;
    types?: Array<{ description?: string; accept: Record<string, string[]> }>;
  }) => Promise<
    Array<{
      getFile: () => Promise<File>;
    }>
  >;
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    excludeAcceptAllOption?: boolean;
    types?: Array<{ description?: string; accept: Record<string, string[]> }>;
  }) => Promise<{
    createWritable: () => Promise<{
      write: (content: string) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
};

function buildPickerTypes(opts: OpenFileOptions | SaveFileOptions) {
  if (!opts.extensions?.length) return undefined;

  return [
    {
      description: opts.filterName ?? "Files",
      accept: {
        "application/json": opts.extensions.map((extension) => `.${extension}`),
      },
    },
  ];
}

/**
 * Open a file picker and return the selected file's text content.
 * Uses the Tauri dialog + fs plugins in desktop, falls back to an
 * invisible `<input type="file">` in the browser.
 */
export async function openTextFile(opts: OpenFileOptions = {}): Promise<string | null> {
  if (isTauri()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const path = await open({
      multiple: false,
      directory: false,
      filters: opts.extensions
        ? [{ name: opts.filterName ?? "Files", extensions: opts.extensions }]
        : undefined,
    });
    if (!path) return null;
    // Use fetch with the Tauri asset protocol to read the file
    const res = await fetch(`asset://localhost/${encodeURIComponent(path as string)}`);
    return res.text();
  }

  const pickerWindow = window as SavePickerWindow;
  if (typeof pickerWindow.showOpenFilePicker === "function") {
    try {
      const [handle] = await pickerWindow.showOpenFilePicker({
        multiple: false,
        excludeAcceptAllOption: Boolean(opts.extensions?.length),
        types: buildPickerTypes(opts),
      });
      if (!handle) return null;
      const file = await handle.getFile();
      return await file.text();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return null;
      }
      throw error;
    }
  }

  // Browser fallback: hidden file input
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    if (opts.extensions?.length) {
      input.accept = opts.extensions.map((e) => `.${e}`).join(",");
    }
    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) {
        resolve(await file.text());
      } else {
        resolve(null);
      }
    };
    // Handle cancel
    input.oncancel = () => resolve(null);
    input.click();
  });
}

/**
 * Save text content to a file.
 * Uses the Tauri dialog plugin for a native save dialog in desktop,
 * falls back to a download link in the browser.
 */
export async function saveTextFile(content: string, opts: SaveFileOptions = {}): Promise<void> {
  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const path = await save({
      defaultPath: opts.defaultName,
      filters: opts.extensions
        ? [{ name: opts.filterName ?? "Files", extensions: opts.extensions }]
        : undefined,
    });
    if (!path) return;
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("save_text_file", { path, content });
    return;
  }

  const pickerWindow = window as SavePickerWindow;
  if (typeof pickerWindow.showSaveFilePicker === "function") {
    try {
      const handle = await pickerWindow.showSaveFilePicker({
        suggestedName: opts.defaultName,
        excludeAcceptAllOption: Boolean(opts.extensions?.length),
        types: buildPickerTypes(opts),
      });
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      throw error;
    }
  }

  // Browser fallback: download link
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = opts.defaultName ?? "download.json";
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Show a confirmation dialog and return the user's choice.
 * Uses the Tauri dialog plugin for a native OS dialog in desktop,
 * falls back to `window.confirm()` in the browser.
 */
export async function confirmAction(message: string, title?: string): Promise<boolean> {
  if (isTauri()) {
    const { confirm } = await import("@tauri-apps/plugin-dialog");
    return confirm(message, { title, kind: "warning" });
  }
  return window.confirm(message);
}
