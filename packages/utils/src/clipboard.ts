/**
 * Platform-aware clipboard utilities.
 *
 * Uses the Tauri clipboard plugin when running in the desktop shell,
 * falls back to the browser Clipboard API in web.
 */

function isTauri(): boolean {
  return typeof window !== "undefined" && Boolean((window as any).__TAURI_INTERNALS__);
}

/**
 * Copy text to the system clipboard.
 */
export async function copyText(text: string): Promise<void> {
  if (isTauri()) {
    const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");
    await writeText(text);
  } else {
    await navigator.clipboard.writeText(text);
  }
}

/**
 * Copy an image blob to the system clipboard.
 * Always uses the browser Clipboard API (Tauri plugin does not support blobs).
 */
export async function copyImageBlob(blob: Blob): Promise<void> {
  await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
}
