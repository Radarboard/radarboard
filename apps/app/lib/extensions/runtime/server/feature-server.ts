import { getAllFeatures, getFeature } from "@radarboard/feature-sdk/registry";
import type {
  FeatureAssistantRuntime,
  FeatureServerRouteInput,
  FeatureServerRouteResult,
  FeatureServerRuntime,
} from "@radarboard/feature-sdk/types";
import { getCredentialRepo, getSettingsRepo } from "@/db/repository";
import { buildDataSourceContext } from "@/lib/data-source-context";
import "@/lib/features";
import { createLogger } from "@radarboard/logger/logger";
import { emitDebugEvent } from "@/lib/debug-events";
import { emitNotificationEvents } from "@/lib/notifications";

const log = createLogger("feature-server");

type HostFeatureServerRouteHandler = (
  input: Omit<FeatureServerRouteInput, "runtime">
) => Promise<FeatureServerRouteResult>;
type HostFeatureServerBackgroundHandler = () => undefined | (() => void);

const featureServerRuntime: FeatureServerRuntime = {
  services: {
    listCredentialKeys: () => getCredentialRepo().listCredentialKeys(),
    getWorkflows: () => getSettingsRepo().getWorkflows(),
    setWorkflows: (workflows: Record<string, unknown>) => getSettingsRepo().setWorkflows(workflows),
    getCredentialRepo,
    buildDataSourceContext,
    emitNotificationEvents,
    emitDebugEvent,
    onSourceError: (integration: string, action: string) => {
      log.warn("feature source failed", { integration, action });
    },
  },
};

const featureAssistantRuntime: FeatureAssistantRuntime = {
  services: featureServerRuntime.services,
};

let configured = false;

export function configureFeatureServerRuntime(): FeatureServerRuntime {
  if (configured) return featureServerRuntime;

  for (const descriptor of getAllFeatures()) {
    descriptor.server?.configure?.(featureServerRuntime);
  }

  configured = true;
  return featureServerRuntime;
}

export function getFeatureServerRoute(
  featureId: string,
  routeId: string
): HostFeatureServerRouteHandler | null {
  configureFeatureServerRuntime();
  const route = getFeature(featureId)?.server?.routes?.[routeId];
  if (!route) return null;

  return (input) => route({ ...input, runtime: featureServerRuntime });
}

export function getFeatureServerBackground(
  featureId: string,
  backgroundId: string
): HostFeatureServerBackgroundHandler | null {
  const runtime = configureFeatureServerRuntime();
  const background = getFeature(featureId)?.server?.background?.[backgroundId];
  if (!background) return null;

  return () => background(runtime);
}

export function getFeatureAssistantPromptSections(): string[] {
  configureFeatureServerRuntime();
  return getAllFeatures().flatMap(
    (descriptor) => descriptor.assistant?.promptContext?.(featureAssistantRuntime) ?? []
  );
}

export function getFeatureAssistantToolExecutors(): Record<
  string,
  // biome-ignore lint/suspicious/noExplicitAny: assistant tool executors have heterogeneous schemas
  (params: any) => Promise<unknown>
> {
  configureFeatureServerRuntime();
  // biome-ignore lint/suspicious/noExplicitAny: assistant tool executors have heterogeneous schemas
  const executors: Record<string, (params: any) => Promise<unknown>> = {};

  for (const descriptor of getAllFeatures()) {
    Object.assign(executors, descriptor.assistant?.toolExecutors?.(featureAssistantRuntime) ?? {});
  }

  return executors;
}
