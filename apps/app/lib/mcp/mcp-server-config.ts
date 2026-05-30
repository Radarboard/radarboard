import {
  isMcpCredentialReference,
  type McpCredentialReference,
  type McpSecretValue,
  type McpServerConfig,
  type ResolvedMcpServerConfig,
  type StdioMcpServerConfig,
} from "@radarboard/types/mcp-server";

type QuoteChar = '"' | "'";

function parseArgs(value: string | undefined): string[] | null {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
      return null;
    }
    return parsed.filter((item) => item.length > 0);
  } catch {
    return null;
  }
}

function parseSecretValue(value: unknown): McpSecretValue | null {
  if (typeof value === "string") return value;
  if (isMcpCredentialReference(value)) return value;
  return null;
}

function parseEnv(value: string | undefined): Record<string, McpSecretValue> | null {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    const env: Record<string, McpSecretValue> = {};
    for (const [key, envValue] of Object.entries(parsed)) {
      const parsedValue = parseSecretValue(envValue);
      if (!parsedValue) return null;
      env[key] = parsedValue;
    }
    return env;
  } catch {
    return null;
  }
}

function parseAuthHeader(
  value: string | undefined,
  refValue: string | undefined
): McpSecretValue | undefined | null {
  if (refValue) {
    try {
      const parsed = JSON.parse(refValue) as unknown;
      return isMcpCredentialReference(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  return value || undefined;
}

export function splitCommandLine(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: QuoteChar | null = null;
  let escaping = false;

  for (const char of input.trim()) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }

    if (quote) {
      ({ current, quote, escaping } = consumeQuotedCharacter(current, quote, char));
      continue;
    }

    if (char === "\\") {
      escaping = true;
      continue;
    }

    if (isQuoteChar(char)) {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      current = flushToken(tokens, current);
      continue;
    }

    current += char;
  }

  if (escaping) {
    current += "\\";
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

function isQuoteChar(char: string): char is QuoteChar {
  return char === '"' || char === "'";
}

function flushToken(tokens: string[], current: string): string {
  if (current.length > 0) {
    tokens.push(current);
  }

  return "";
}

function consumeQuotedCharacter(
  current: string,
  quote: QuoteChar,
  char: string
): { current: string; quote: QuoteChar | null; escaping: boolean } {
  if (char === "\\" && quote !== "'") {
    return { current, quote, escaping: true };
  }

  if (char === quote) {
    return { current, quote: null, escaping: false };
  }

  return { current: `${current}${char}`, quote, escaping: false };
}

export function normalizeStdioCommand(
  command: string,
  args?: string[]
): Pick<StdioMcpServerConfig, "command" | "args"> {
  const trimmedCommand = command.trim();
  const normalizedArgs = (args ?? []).filter((value) => value.trim().length > 0);
  if (!trimmedCommand) {
    return { command: "", args: normalizedArgs.length > 0 ? normalizedArgs : undefined };
  }

  const parsed = splitCommandLine(trimmedCommand);
  if (parsed.length === 0) {
    return {
      command: trimmedCommand,
      args: normalizedArgs.length > 0 ? normalizedArgs : undefined,
    };
  }

  const [normalizedCommand, ...inlineArgs] = parsed;
  if (!normalizedCommand) {
    return {
      command: trimmedCommand,
      args: normalizedArgs.length > 0 ? normalizedArgs : undefined,
    };
  }
  const combinedArgs = normalizeNpxArgs(normalizedCommand, [...inlineArgs, ...normalizedArgs]);

  return {
    command: normalizedCommand,
    args: combinedArgs.length > 0 ? combinedArgs : undefined,
  };
}

function normalizeNpxArgs(command: string, args: string[]): string[] {
  if (command !== "npx" || args.length < 2) return args;

  const yesFlags = args.filter((arg) => arg === "-y" || arg === "--yes");
  if (yesFlags.length === 0) return args;

  const rest = args.filter((arg) => arg !== "-y" && arg !== "--yes");
  return [...yesFlags, ...rest];
}

export function normalizeStdioServerConfig(server: StdioMcpServerConfig): StdioMcpServerConfig {
  const normalized = normalizeStdioCommand(server.command, server.args);
  return {
    ...server,
    command: normalized.command,
    args: normalized.args,
  };
}

export function formatStdioLaunchError(input: {
  command: string;
  args?: string[];
  message: string;
  stderr?: string;
}): string {
  const commandText = [input.command, ...(input.args ?? [])].join(" ").trim();
  const stderr = input.stderr?.trim();
  const missingEnvMessage = buildMissingEnvError(stderr);
  if (missingEnvMessage) {
    return missingEnvMessage;
  }

  if (input.message.includes("ENOENT")) {
    return buildEnoentError(input.command, commandText, stderr);
  }

  if (input.message.includes("timed out")) {
    return buildTimeoutError(input.message, stderr);
  }

  return stderr ? `${input.message}\n${stderr}` : input.message;
}

function buildMissingEnvError(stderr?: string): string | null {
  const missingEnvMatch = stderr?.match(/([A-Z0-9_]+) environment variable is required/i);
  const envName = missingEnvMatch?.[1];
  if (!envName) return null;

  return joinErrorDetails(
    [
      `Missing required environment variable: ${envName}`,
      `Add it in the MCP server Environment Variables field as ${envName}=...`,
    ],
    stderr
  );
}

function buildEnoentError(command: string, commandText: string, stderr?: string): string {
  const details = [
    `Failed to start MCP command: ${commandText || command}`,
    `Executable not found: ${command}`,
  ];

  if (command === "npx") {
    details.push("Make sure Node.js and npx are installed and available in PATH.");
  }

  return joinErrorDetails(details, stderr);
}

function buildTimeoutError(message: string, stderr?: string): string {
  const details = [message];

  if (stderr?.includes("will be installed")) {
    details.push(
      "npx is still downloading the package on first run. Wait for the install to finish, then test again."
    );
  }

  return joinErrorDetails(details, stderr);
}

function joinErrorDetails(details: string[], stderr?: string): string {
  if (stderr) {
    details.push(stderr);
  }

  return details.join("\n");
}

export function parseStoredMcpServerConfig(
  name: string,
  values: Record<string, string>
): McpServerConfig | null {
  const docsUrl = values.docsUrl || undefined;
  const enabled = values.enabled === "true";
  const authHeader = parseAuthHeader(values.authHeader, values.authHeaderRef);
  if (authHeader === null) return null;

  if (values.type === "stdio") {
    if (!values.command) return null;

    const args = parseArgs(values.args);
    if (args === null) return null;

    const env = parseEnv(values.env);
    if (env === null) return null;

    return normalizeStdioServerConfig({
      name,
      type: "stdio",
      command: values.command,
      args: args.length > 0 ? args : undefined,
      env: Object.keys(env).length > 0 ? env : undefined,
      cwd: values.cwd || undefined,
      docsUrl,
      enabled,
    });
  }

  if (!values.url) return null;

  return {
    name,
    type: "streamable-http",
    url: values.url,
    authHeader,
    docsUrl,
    enabled,
  };
}

export function serializeMcpServerConfig(server: McpServerConfig): Record<string, string> {
  const base: Record<string, string> = {
    type: server.type,
    enabled: server.enabled ? "true" : "false",
  };

  if (server.docsUrl) {
    base.docsUrl = server.docsUrl;
  }

  if (server.type === "stdio") {
    const normalized = normalizeStdioServerConfig(server);

    base.command = normalized.command;
    if (normalized.args && normalized.args.length > 0) {
      base.args = JSON.stringify(normalized.args);
    }
    if (normalized.env && Object.keys(normalized.env).length > 0) {
      base.env = JSON.stringify(normalized.env);
    }
    if (normalized.cwd) {
      base.cwd = normalized.cwd;
    }
    return base;
  }

  base.url = server.url;
  if (typeof server.authHeader === "string") {
    base.authHeader = server.authHeader;
  } else if (server.authHeader) {
    base.authHeaderRef = JSON.stringify(server.authHeader);
  }
  return base;
}

export function getMcpServerSummary(server: McpServerConfig): string {
  if (server.type === "stdio") {
    return [server.command, ...(server.args ?? [])].join(" ");
  }
  return server.url;
}

function interpolateTemplate(template: string | undefined, value: string): string {
  if (!template) return value;
  return template.includes("{{value}}") ? template.replaceAll("{{value}}", value) : template;
}

async function resolveSecretValue(
  value: McpSecretValue | undefined,
  resolveCredential: (key: string) => Promise<Record<string, string> | null>,
  cache: Map<string, Record<string, string> | null>
): Promise<string | undefined> {
  if (!value) return undefined;
  if (typeof value === "string") return value;

  let credentialValues = cache.get(value.credentialKey);
  if (credentialValues === undefined) {
    credentialValues = await resolveCredential(value.credentialKey);
    cache.set(value.credentialKey, credentialValues);
  }

  const raw = credentialValues?.[value.field];
  if (!raw) {
    throw new Error(
      `Missing credential field "${value.field}" on "${value.credentialKey}" for MCP server resolution`
    );
  }

  return interpolateTemplate(value.template, raw);
}

export function buildCredentialReference(
  credentialKey: string,
  field: string,
  template?: string
): McpCredentialReference {
  return {
    type: "integration-credential",
    credentialKey,
    field,
    ...(template ? { template } : {}),
  };
}

export async function resolveMcpServerConfig(
  server: McpServerConfig,
  resolveCredential: (key: string) => Promise<Record<string, string> | null>
): Promise<ResolvedMcpServerConfig> {
  const cache = new Map<string, Record<string, string> | null>();

  if (server.type === "stdio") {
    const envEntries = await Promise.all(
      Object.entries(server.env ?? {}).map(async ([key, value]) => [
        key,
        await resolveSecretValue(value, resolveCredential, cache),
      ])
    );

    return {
      ...server,
      env: Object.fromEntries(
        envEntries.filter((entry): entry is [string, string] => typeof entry[1] === "string")
      ),
    };
  }

  return {
    ...server,
    authHeader: await resolveSecretValue(server.authHeader, resolveCredential, cache),
  };
}
