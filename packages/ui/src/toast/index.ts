"use client";

export type UiToastVariant = "success" | "error";

export interface UiToastDetail {
  variant: UiToastVariant;
  title: string;
  description?: string;
}

export const UI_TOAST_EVENT = "radarboard:toast";

export function emitUiToast(detail: UiToastDetail) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<UiToastDetail>(UI_TOAST_EVENT, {
      detail,
    })
  );
}
