export interface PiperConfig {
  modelPath?: string;
  command?: string;
  speaker?: string;
}

export function getReadAloudMode(config: PiperConfig): "audio" | "unavailable" {
  return config.modelPath?.trim() ? "audio" : "unavailable";
}

export async function synthesizeWithPiper(
  text: string,
  config: PiperConfig
): Promise<Buffer | null> {
  const modelPath = config.modelPath?.trim();
  const command = config.command?.trim() || "piper";
  const speaker = config.speaker?.trim();
  if (!modelPath) return null;

  const { spawn } = await import("node:child_process");
  const { mkdtemp, readFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");

  const tempDir = await mkdtemp(join(tmpdir(), "rss-reader-piper-"));
  const outputFile = join(tempDir, "speech.wav");
  const args = ["--model", modelPath, "--output_file", outputFile];

  if (speaker) {
    args.push("--speaker", speaker);
  }

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: ["pipe", "ignore", "pipe"],
      });

      let stderr = "";
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += String(chunk);
      });

      child.on("error", reject);
      child.on("close", (code: number | null) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(stderr.trim() || `Piper exited with code ${String(code)}`));
      });

      child.stdin.write(text);
      child.stdin.end();
    });

    return await readFile(outputFile);
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
