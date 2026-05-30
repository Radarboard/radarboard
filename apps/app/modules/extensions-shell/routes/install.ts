import { z } from "zod";
import { errorJson, parseBody } from "@/lib/api";
import { installExtension } from "@/lib/extension-installer/install";
import { installExtensionPackage } from "@/lib/extension-installer/install-package";
import { parseGitHubUrl } from "@/lib/extension-installer/parse-github-url";
import { validateGitHubExtension } from "@/lib/extension-installer/validate-package";

const installExtensionSchema = z.object({
  githubUrl: z.string().min(1),
});

export async function handleInstallExtension(request: Request) {
  const parsed = await parseBody(request, installExtensionSchema);
  if (!parsed.ok) return parsed.response;
  const { githubUrl } = parsed.data;

  const repo = parseGitHubUrl(githubUrl);
  if (!repo) {
    return errorJson(
      400,
      "Invalid GitHub URL. Use https://github.com/owner/repo or owner/repo format."
    );
  }

  const validation = await validateGitHubExtension(repo);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      if (validation.kind === "package") {
        const pkgResult = validation.result;

        if (!pkgResult.valid || !pkgResult.manifest) {
          send({
            type: "result",
            success: false,
            error: "Package validation failed",
            errors: pkgResult.errors,
          });
          controller.close();
          return;
        }

        send({
          type: "info",
          message: `Installing extension package "${pkgResult.manifest.name}" with ${pkgResult.manifest.extensions.length} extension(s)`,
        });

        const result = await installExtensionPackage(repo, pkgResult.manifest, (progress) =>
          send({ type: "progress", ...progress })
        );

        send({ type: "result", ...result });
      } else {
        const singleResult = validation.result;

        if (!singleResult.valid || !singleResult.category || !singleResult.id) {
          send({
            type: "result",
            success: false,
            error: "Extension validation failed",
            validation: singleResult,
          });
          controller.close();
          return;
        }

        const result = await installExtension(
          repo,
          singleResult.category,
          singleResult.id,
          (progress) => send({ type: "progress", ...progress })
        );

        send({ type: "result", ...result });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      // biome-ignore lint/style/useNamingConvention: standard HTTP header casing
      Connection: "keep-alive",
    },
  });
}
