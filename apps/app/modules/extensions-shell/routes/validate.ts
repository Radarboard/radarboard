import { NextResponse } from "next/server";
import { z } from "zod";
import { errorJson, parseBody } from "@/lib/api";
import { parseGitHubUrl } from "@/lib/extension-installer/parse-github-url";
import { validateGitHubExtension } from "@/lib/extension-installer/validate-package";

const validateExtensionSchema = z.object({
  githubUrl: z.preprocess(
    (value) => (typeof value === "string" ? value : ""),
    z.string().min(1, "githubUrl is required")
  ),
});

export async function handleValidateExtension(request: Request) {
  const parsed = await parseBody(request, validateExtensionSchema);
  if (!parsed.ok) return parsed.response;
  const { githubUrl } = parsed.data;

  const repo = parseGitHubUrl(githubUrl);
  if (!repo) {
    return errorJson(
      400,
      "Invalid GitHub URL. Use https://github.com/owner/repo or owner/repo format."
    );
  }

  const result = await validateGitHubExtension(repo);

  return NextResponse.json(result);
}
