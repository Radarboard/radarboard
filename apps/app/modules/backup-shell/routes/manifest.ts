import { NextResponse } from "next/server";
import { errorJson } from "@/lib/api";
import { getLatestBackupManifest } from "@/modules/backup-shell/routes/backup";

/** GET /api/backup/manifest — returns the latest backup manifest. */
export async function handleGetBackupManifest() {
  const manifest = await getLatestBackupManifest();

  if (!manifest) {
    return errorJson(404, "No backup has been run yet");
  }

  return NextResponse.json(manifest);
}
