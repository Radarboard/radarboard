import {
  copyImageBlob as copyImageBlobImpl,
  copyText as copyTextImpl,
} from "@radarboard/utils/clipboard";

export async function copyText(text: string): Promise<boolean> {
  await copyTextImpl(text);
  return true;
}

export async function copyImageBlob(blob: Blob): Promise<boolean> {
  await copyImageBlobImpl(blob);
  return true;
}
