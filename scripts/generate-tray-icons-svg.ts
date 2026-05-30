#!/usr/bin/env bun
/**
 * Generate monochrome tray icons for macOS menu bar.
 *
 * Purpose-built for 22pt (@2x = 44px). Uses ~18pt artwork centered in a 22pt
 * canvas so the macOS-rendered title text (unread count) has breathing room.
 *
 * Template images: black strokes + transparency. macOS auto-tints for light/dark.
 */

import sharp from "sharp";
import { join } from "node:path";

const PROJECT_ROOT = "/Users/thedaviddias/Projects/radarboard";
const OUT_DIR = join(PROJECT_ROOT, "apps/desktop/src-tauri/tray-icons");
const SIZE = 44; // 22pt @2x

// Radar icon centered in canvas with padding for title text spacing.
// ~36px artwork in 44px canvas = ~4px padding each side = ~2pt at @2x
function radarSvg(opts: { opacity?: number; fillCenter?: boolean; alert?: boolean } = {}): string {
  const { opacity = 1.0, fillCenter = false, alert = false } = opts;
  const cx = 22;
  const cy = 22;
  const r1 = 16; // outer circle radius — 73% fill, matches system icons
  const r2 = 9;  // inner circle radius — proportional to outer
  const sw = 2.5; // stroke width — 1.25pt at @2x, matches system icon weight
  // Sweep line endpoint at 45 degrees NE
  const sweepX = cx + Math.round(r1 * Math.cos(Math.PI / 4));
  const sweepY = cy - Math.round(r1 * Math.sin(Math.PI / 4));

  let extra = "";
  if (alert) {
    // Small filled exclamation dot above the outer circle
    extra = `<circle cx="${cx + 12}" cy="${cy - 12}" r="3.5" fill="black" stroke="none" />`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <g opacity="${opacity}" fill="none" stroke="black" stroke-width="${sw}" stroke-linecap="round">
    <circle cx="${cx}" cy="${cy}" r="${r1}" />
    <circle cx="${cx}" cy="${cy}" r="${r2}" />
    <line x1="${cx}" y1="${cy}" x2="${sweepX}" y2="${sweepY}" />
    <circle cx="${cx}" cy="${cy}" r="${fillCenter ? 4 : 2.5}" fill="black" stroke="none" />
  </g>
  ${extra}
</svg>`;
}

async function svgToFile(svg: string, filename: string): Promise<void> {
  await sharp(Buffer.from(svg), { density: 72 })
    .resize(SIZE, SIZE)
    .ensureAlpha()
    .png({ compressionLevel: 9 })
    .toFile(join(OUT_DIR, filename));
  console.log(`  Saved: ${filename}`);
}

async function main() {
  console.log("Generating SVG-based tray icons (44x44 @2x template images)...\n");

  // Normal: clean radar outline
  await svgToFile(radarSvg(), "tray-normal.png");

  // Badge: slightly larger center dot to subtly indicate unread state
  // (the actual count is shown by macOS via tray.set_title())
  await svgToFile(radarSvg({ fillCenter: true }), "tray-badge.png");

  // Critical: radar + alert dot in top-right
  await svgToFile(radarSvg({ alert: true }), "tray-critical.png");

  // Paused: 50% opacity
  await svgToFile(radarSvg({ opacity: 0.5 }), "tray-paused.png");

  console.log("\nDone! Tray icons have padding for title text spacing.");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
