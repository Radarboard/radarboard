"use client";

import { domToPng } from "modern-screenshot";
import { type RefObject, useCallback, useState } from "react";

interface UseExportWidgetImageOptions {
  cardRef: RefObject<HTMLElement | null>;
  title: string;
}

const EXPORT_EXCLUDE_SELECTOR = "[data-export-exclude]";
const PADDING = 32;
const BRANDING_HEIGHT = 28;
const BG_COLOR = "#0a0a0a";

function filterExcluded(node: Node): boolean {
  if (node instanceof HTMLElement && node.matches(EXPORT_EXCLUDE_SELECTOR)) {
    return false;
  }
  return true;
}

function sanitizeFilename(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Load a data URL into an HTMLImageElement. */
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Captures the widget in-place, then uses Canvas to add padding and branding
 * around the captured image. No DOM manipulation — the live tree is untouched.
 */
async function captureWithBranding(node: HTMLElement): Promise<Blob> {
  const scale = window.devicePixelRatio || 2;

  // Step 1: capture the widget exactly where it is in the DOM
  const rawDataUrl = await domToPng(node, {
    scale,
    backgroundColor: BG_COLOR,
    filter: filterExcluded,
  });

  // Step 2: load the captured image
  const img = await loadImage(rawDataUrl);

  // Step 3: compose final image with padding + branding via Canvas
  const pad = PADDING * scale;
  const brandingH = BRANDING_HEIGHT * scale;
  const canvasW = img.width + pad * 2;
  const canvasH = img.height + pad * 2 + brandingH;

  const canvas = document.createElement("canvas");
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  // Background
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Widget image
  ctx.drawImage(img, pad, pad);

  // "radarboard" branding — bottom right
  ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
  ctx.font = `${11 * scale}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
  ctx.textAlign = "right";
  ctx.fillText("radarboard", canvasW - pad, canvasH - pad / 2);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      "image/png"
    );
  });
}

export function useExportWidgetImage({ cardRef, title }: UseExportWidgetImageOptions) {
  const [isExporting, setIsExporting] = useState(false);

  const exportAsPng = useCallback(async () => {
    const node = cardRef.current;
    if (!node || isExporting) return;

    setIsExporting(true);
    try {
      const blob = await captureWithBranding(node);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `${sanitizeFilename(title)}-${Date.now()}.png`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }, [cardRef, title, isExporting]);

  const copyToClipboard = useCallback(async () => {
    const node = cardRef.current;
    if (!node || isExporting) return;

    setIsExporting(true);
    try {
      const blob = await captureWithBranding(node);
      const { copyImageBlob } = await import("@radarboard/utils/clipboard");
      await copyImageBlob(blob);
    } finally {
      setIsExporting(false);
    }
  }, [cardRef, isExporting]);

  return { exportAsPng, copyToClipboard, isExporting };
}
