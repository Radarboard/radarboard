#!/usr/bin/env tsx
/**
 * Capture screenshots of all widgets from the widget sandbox.
 *
 * Uses Playwright to headlessly render each widget in the sandbox page
 * and save screenshots to a shared directory. These can be referenced
 * by the `screenshots` field in widget descriptors.
 *
 * Prerequisites:
 *   - Dev server running: pnpm dev (port 1355)
 *   - Playwright installed: npx playwright install chromium
 *
 * Usage:
 *   pnpm capture:screenshots
 *   pnpm capture:screenshots --widget analytics
 *   pnpm capture:screenshots --state happy
 */

import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), "..");
const OUTPUT_DIR = join(ROOT, "apps/app/public/screenshots/widgets");
const SANDBOX_URL = "http://localhost:1355/debug/widget-sandbox";

const args = process.argv.slice(2);
const widgetFilter = args.includes("--widget")
  ? args[args.indexOf("--widget") + 1]
  : undefined;
const stateFilter = args.includes("--state")
  ? args[args.indexOf("--state") + 1]
  : "happy";

async function main() {
  // Dynamic import — Playwright may not be installed
  let chromium: typeof import("playwright").chromium;
  try {
    const pw = await import("playwright");
    chromium = pw.chromium;
  } catch {
    console.error("Playwright not installed. Run: npx playwright install chromium");
    process.exit(1);
  }

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log("Launching browser...");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  console.log(`Navigating to widget sandbox: ${SANDBOX_URL}`);
  await page.goto(SANDBOX_URL, { waitUntil: "networkidle" });

  // Get all widget IDs from the dropdown
  const widgetIds = await page.evaluate(() => {
    const select = document.getElementById("sandbox-widget-select") as HTMLSelectElement;
    if (!select) return [];
    return Array.from(select.options)
      .filter((opt) => opt.value !== "__all__")
      .map((opt) => opt.value);
  });

  console.log(`Found ${widgetIds.length} widgets`);

  const targets = widgetFilter
    ? widgetIds.filter((id) => id === widgetFilter)
    : widgetIds;

  if (targets.length === 0) {
    console.error(widgetFilter ? `Widget "${widgetFilter}" not found` : "No widgets found");
    await browser.close();
    process.exit(1);
  }

  for (const widgetId of targets) {
    console.log(`Capturing: ${widgetId} (${stateFilter})`);

    // Select the specific widget
    await page.selectOption("#sandbox-widget-select", widgetId);
    await page.waitForTimeout(500); // Let it render

    // Find the widget preview card for the target state
    const stateLabels: Record<string, string> = {
      happy: "Happy Path",
      empty: "Empty",
      loading: "Loading",
      error: "Error",
    };
    const label = stateLabels[stateFilter] ?? stateFilter;

    // Screenshot the first preview card (the selected state)
    const previewCard = page.locator(`text=${label}`).first().locator("..").locator("div").last();
    const outputPath = join(OUTPUT_DIR, `${widgetId}-${stateFilter}.png`);

    try {
      await previewCard.screenshot({ path: outputPath });
      console.log(`  → ${outputPath}`);
    } catch {
      // Fallback: screenshot the whole widget section
      const section = page.locator(`section:has(h2:has-text("${widgetId}"))`).first();
      if (await section.count()) {
        await section.screenshot({ path: outputPath });
        console.log(`  → ${outputPath} (section fallback)`);
      } else {
        console.warn(`  ⚠ Could not capture ${widgetId}`);
      }
    }
  }

  await browser.close();
  console.log(`\nDone. Screenshots saved to ${OUTPUT_DIR}`);
}

main();
