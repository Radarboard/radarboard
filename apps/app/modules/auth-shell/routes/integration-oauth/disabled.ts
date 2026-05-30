import { errorJson } from "@/lib/api";

export async function handleDisabledLlmOAuth() {
  return errorJson(
    501,
    "OAuth for LLM providers is not enabled on this deployment yet. Use API keys in Settings > Assistant for now."
  );
}
