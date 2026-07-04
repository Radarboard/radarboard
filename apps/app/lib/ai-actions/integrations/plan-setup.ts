/**
 * Assistant action: plan how to set up a service (the ladder orchestrator).
 *
 * Read-only. Runs discovery, picks the best rung (desktop-safe order), and
 * returns a human-readable proposal plus a machine-readable `actionSpec` naming
 * the executor tool + the params still needed from the user. The assistant
 * presents the proposal and only calls the executor after the user approves —
 * the executors themselves also enforce `confirmedByUser`.
 */
import {
  type CommunityOption,
  executeFindOptions,
  type IntegrationOption,
  type IntegrationRung,
  type McpOption,
  type RegisteredOption,
} from "./find-options";

export interface ActionSpec {
  rung: IntegrationRung;
  /** The executor tool to call after approval, or null if no assistant executor applies. */
  tool: "connect_integration" | "connect_mcp_server" | "create_rest_integration" | null;
  /** Partial params to seed the executor call with. */
  params: Record<string, unknown>;
  /** What the user still needs to supply (e.g. credentials, an endpoint URL). */
  userMustProvide: string[];
}

export interface PlanSetupResult {
  service: string;
  recommendedRung: IntegrationRung;
  /** Human-readable summary the assistant presents before acting. */
  proposal: string;
  actionSpec: ActionSpec;
  /** Other rungs that also matched, for transparency. */
  alternatives: IntegrationRung[];
  options: IntegrationOption[];
}

function planRegistered(
  option: RegisteredOption
): Omit<PlanSetupResult, "service" | "options" | "alternatives"> {
  if (option.connected) {
    return {
      recommendedRung: "registered",
      proposal: `"${option.name}" is already connected. You can add its widgets to the dashboard now.`,
      actionSpec: {
        rung: "registered",
        tool: null,
        params: { integrationId: option.id },
        userMustProvide: [],
      },
    };
  }
  if (option.authType === "oauth") {
    return {
      recommendedRung: "registered",
      proposal: `"${option.name}" is available but uses OAuth — connect it from Settings → Integrations (an assistant tool can't complete the browser redirect).`,
      actionSpec: {
        rung: "registered",
        tool: null,
        params: { integrationId: option.id },
        userMustProvide: [],
      },
    };
  }
  return {
    recommendedRung: "registered",
    proposal: `Connect the built-in "${option.name}" integration by providing its credentials, then I'll test and save them.`,
    actionSpec: {
      rung: "registered",
      tool: "connect_integration",
      params: { integrationId: option.id },
      userMustProvide: option.authType === "none" ? [] : ["credentials"],
    },
  };
}

function planMcp(option: McpOption): Omit<PlanSetupResult, "service" | "options" | "alternatives"> {
  const userMustProvide = [
    ...(option.url ? [] : ["url"]),
    ...(option.requiresAuth ? ["token"] : []),
  ];
  const docs = option.docsUrl ? ` See ${option.docsUrl} for the endpoint and token.` : "";
  const auth = option.requiresAuth ? ` It needs ${option.authHint ?? "an auth token"}.` : "";
  return {
    recommendedRung: "mcp",
    proposal: `Connect the ${option.name} MCP server as a data source.${auth}${docs} I'll add it only after you confirm.`,
    actionSpec: {
      rung: "mcp",
      tool: "connect_mcp_server",
      params: {
        name: option.service,
        ...(option.url ? { url: option.url } : {}),
        ...(option.docsUrl ? { docsUrl: option.docsUrl } : {}),
      },
      userMustProvide,
    },
  };
}

function planCommunity(
  option: CommunityOption
): Omit<PlanSetupResult, "service" | "options" | "alternatives"> {
  const where = option.repoUrl ? ` (${option.repoUrl})` : "";
  return {
    recommendedRung: "community",
    proposal: `A community integration exists — "${option.name}"${where}. Installing community extensions is done from Settings → Community (it requires a build step, so it's not available inside the packaged app).`,
    actionSpec: { rung: "community", tool: null, params: { id: option.id }, userMustProvide: [] },
  };
}

function planRest(service: string): Omit<PlanSetupResult, "service" | "options" | "alternatives"> {
  return {
    recommendedRung: "rest",
    proposal: `No existing integration matched "${service}". I can scaffold a no-code REST integration against its API — give me the base URL (https), how it authenticates, and which endpoints to pull.`,
    actionSpec: {
      rung: "rest",
      tool: "create_rest_integration",
      params: {},
      userMustProvide: ["baseUrl", "auth", "dataSources"],
    },
  };
}

function firstOfRung<T extends IntegrationOption>(
  options: IntegrationOption[],
  rung: IntegrationRung
): T | undefined {
  return options.find((o) => o.rung === rung) as T | undefined;
}

export async function executePlanSetup(params: { service: string }): Promise<PlanSetupResult> {
  const discovery = await executeFindOptions({ service: params.service });
  const { service, options, recommendedRung } = discovery;

  let plan: Omit<PlanSetupResult, "service" | "options" | "alternatives">;
  switch (recommendedRung) {
    case "registered":
      plan = planRegistered(
        firstOfRung<RegisteredOption>(options, "registered") as RegisteredOption
      );
      break;
    case "mcp":
      plan = planMcp(firstOfRung<McpOption>(options, "mcp") as McpOption);
      break;
    case "community":
      plan = planCommunity(firstOfRung<CommunityOption>(options, "community") as CommunityOption);
      break;
    default:
      plan = planRest(service);
  }

  const alternatives = [...new Set(options.map((o) => o.rung))].filter(
    (rung) => rung !== recommendedRung
  );

  return { service, options, alternatives, ...plan };
}
