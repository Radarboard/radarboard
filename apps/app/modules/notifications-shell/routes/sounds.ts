import fs from "node:fs";
import { createLogger } from "@radarboard/logger";
import { withLogging } from "@radarboard/logger/middleware";
import { API_ROUTES } from "@radarboard/types/api-routes";
import { NextResponse } from "next/server";
import { z } from "zod";
import { errorJson } from "@/lib/api";

const log = createLogger(API_ROUTES.notificationSounds);

const SOUNDS_DIR = "apps/app/public/sounds";

const DownloadSchema = z.object({
  url: z.string().url().startsWith("https://www.soundcn.xyz/r/"),
});

export const handleListSounds = withLogging(API_ROUTES.notificationSounds, async () => {
  try {
    if (!fs.existsSync(SOUNDS_DIR)) {
      return NextResponse.json({ sounds: [] });
    }

    const files = fs.readdirSync(SOUNDS_DIR);
    const sounds = files
      .filter((f) => f.endsWith(".mp3"))
      .map((f) => ({
        id: f.replace(".mp3", ""),
        label: f
          .replace(".mp3", "")
          .split("-")
          .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
          .join(" "),
        url: `/sounds/${f}`,
      }));

    return NextResponse.json({ sounds });
  } catch (error) {
    log.error("Failed to list sounds", { error });
    return errorJson(500, "Failed to list sounds");
  }
});

export const handleDownloadSound = withLogging(API_ROUTES.notificationSounds, async (req) => {
  try {
    const body = await req.json();
    const parsed = DownloadSchema.safeParse(body);
    if (!parsed.success) {
      return errorJson(400, "Invalid soundcn registry URL");
    }

    const { url } = parsed.data;
    const soundName = url.split("/").pop()?.replace(".json", "");
    if (!soundName) {
      return errorJson(400, "Could not determine sound name");
    }

    // Fetch from SoundCN
    const res = await fetch(url);
    if (!res.ok) {
      log.error("Failed to fetch sound from SoundCN", { url, status: res.status });
      return errorJson(502, "Failed to fetch sound from SoundCN");
    }

    const data = await res.json();
    const file = data.files?.[0];
    if (!file || !file.content) {
      log.error("Sound registry JSON missing content", { url, data });
      return errorJson(502, "Sound registry JSON missing content");
    }

    // Extract dataUri from TS content if needed, or assume raw dataUri if registry changed
    let base64 = "";
    if (file.content.includes("dataUri:")) {
      const match = file.content.match(/dataUri:\s*"(data:audio\/mpeg;base64,[^"]+)"/);
      if (match?.[1]) {
        base64 = match[1].split(",")[1];
      }
    } else if (file.content.startsWith("data:audio/mpeg;base64,")) {
      base64 = file.content.split(",")[1];
    }

    if (!base64) {
      log.error("Could not extract audio data from registry", {
        url,
        content: file.content.slice(0, 100),
      });
      return errorJson(502, "Could not extract audio data from registry");
    }

    // Ensure dir exists
    if (!fs.existsSync(SOUNDS_DIR)) {
      fs.mkdirSync(SOUNDS_DIR, { recursive: true });
    }

    // Save file
    const filePath = `apps/app/public/sounds/${soundName}.mp3`;
    fs.writeFileSync(filePath, Buffer.from(base64, "base64"));

    log.info("Sound saved successfully", { soundName, filePath });

    return NextResponse.json({
      success: true,
      sound: {
        id: soundName,
        label: soundName
          .split("-")
          .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
          .join(" "),
        url: `/sounds/${soundName}.mp3`,
      },
    });
  } catch (error) {
    log.error("Failed to download sound", { error });
    const msg = error instanceof Error ? error.message : "Unknown error";
    return errorJson(500, msg);
  }
});
