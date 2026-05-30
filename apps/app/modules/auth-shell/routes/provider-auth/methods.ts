import { listProviders } from "@radarboard/llm/providers/registry";
import { NextResponse } from "next/server";
import { getProviderAuthMethods } from "@/lib/auth/provider-auth";

export async function handleListProviderAuthMethods() {
  const providers = listProviders();
  const methods = Object.fromEntries(
    providers.map((provider) => [provider.id, getProviderAuthMethods(provider.id)])
  );
  return NextResponse.json(methods);
}
