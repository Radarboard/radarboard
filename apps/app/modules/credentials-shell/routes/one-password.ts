import { execSync } from "node:child_process";
import { createLogger } from "@radarboard/logger/logger";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCredentialRepo } from "@/db/repository";
import { errorJson, parseBody } from "@/lib/api";

const log = createLogger("api/credentials/1password");
const APP_TITLE_PREFIX = "Radarboard";
const onePasswordActionSchema = z.object({
  action: z.enum(["export", "import"]),
  vault: z.string().optional(),
});

function isOpAvailable(): boolean {
  try {
    execSync("op account list --format=json", { timeout: 5000, stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

async function handleExport(vault: string) {
  const repo = getCredentialRepo();
  const keys = await repo.listCredentialKeys();
  let exported = 0;

  for (const key of keys) {
    const creds = await repo.getCredential(key);
    if (!creds) continue;

    const title = `${APP_TITLE_PREFIX} - ${key}`;
    try {
      execSync(`op item get "${title}" --vault="${vault}" --format=json`, {
        timeout: 10000,
        stdio: "pipe",
      });
      execSync(
        `op item edit "${title}" --vault="${vault}" ${Object.entries(creds)
          .map(([k, v]) => `"${k}=${v}"`)
          .join(" ")}`,
        { timeout: 10000, stdio: "pipe" }
      );
    } catch {
      try {
        execSync(
          `op item create --category=api_credential --title="${title}" --vault="${vault}" ${Object.entries(
            creds
          )
            .map(([k, v]) => `"${k}[password]=${v}"`)
            .join(" ")}`,
          { timeout: 10000, stdio: "pipe" }
        );
      } catch (createErr) {
        const msg = createErr instanceof Error ? createErr.message : String(createErr);
        return errorJson(500, `Failed to create 1Password item for ${key}: ${msg}`, {
          success: false,
          exported,
        });
      }
    }
    exported++;
  }

  return NextResponse.json({ success: true, exported, total: keys.length });
}

async function handleImport(vault: string) {
  const repo = getCredentialRepo();
  let imported = 0;

  try {
    const output = execSync(
      `op item list --vault="${vault}" --format=json --categories api_credential`,
      { timeout: 10000, stdio: "pipe" }
    );
    const items = JSON.parse(output.toString()) as Array<{ id: string; title: string }>;
    const radarboardItems = items.filter((i) => i.title.startsWith(APP_TITLE_PREFIX));

    for (const item of radarboardItems) {
      const credKey = item.title.replace(`${APP_TITLE_PREFIX} - `, "");
      const detailOutput = execSync(`op item get "${item.id}" --format=json`, {
        timeout: 10000,
        stdio: "pipe",
      });
      const detail = JSON.parse(detailOutput.toString()) as {
        fields?: Array<{ label: string; value: string }>;
      };

      if (!detail.fields) continue;

      const values: Record<string, string> = {};
      for (const field of detail.fields) {
        if (field.label && field.value) {
          values[field.label] = field.value;
        }
      }

      if (Object.keys(values).length > 0) {
        await repo.setCredential(credKey, values);
        imported++;
      }
    }

    return NextResponse.json({ success: true, imported });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("1Password import failed", { error: err });
    return errorJson(500, message, { success: false, imported });
  }
}

export async function handleOnePasswordCredentials(request: Request) {
  try {
    const parsed = await parseBody(request, onePasswordActionSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const vault = body.vault ?? "Dev";

    if (!isOpAvailable()) {
      return errorJson(
        500,
        "1Password CLI (op) not found or not authenticated. Install from https://1password.com/downloads/command-line/ and run: op signin",
        { success: false }
      );
    }

    if (body.action === "export") {
      return handleExport(vault);
    }

    if (body.action === "import") {
      return handleImport(vault);
    }

    return errorJson(400, "Invalid action", { success: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("1Password action failed", { error: err });
    return errorJson(500, message, { success: false });
  }
}
