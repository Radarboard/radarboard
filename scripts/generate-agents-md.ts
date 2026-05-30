/**
 * Generate AGENTS.md files for packages/integrations and packages/widgets.
 *
 * These files provide AI agents with a structured overview of each package,
 * making it faster to understand the codebase without reading every file.
 *
 * Usage: pnpm generate-agents-md
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readFile(path: string): string {
  return existsSync(path) ? readFileSync(path, "utf-8") : "";
}

function extractQuoted(content: string, key: string): string | null {
  // Match: key: "value" or key: 'value' (possibly multi-line with concatenation)
  const singleLine = new RegExp(`${key}:\\s*["']([^"']+)["']`);
  const match = content.match(singleLine);
  if (match) return match[1] ?? null;

  // Multi-line: key:\n    "value"
  const multiLine = new RegExp(`${key}:\\s*\\n\\s*["']([^"']+)["']`);
  const match2 = content.match(multiLine);
  return match2?.[1] ?? null;
}

function extractAuthType(content: string): string {
  const match = content.match(/type:\s*["'](api_key|oauth|none)["']/);
  return match?.[1] ?? "unknown";
}

function extractCategory(content: string): string {
  const match = content.match(/category:\s*["'](\w+)["']/);
  return match?.[1] ?? "unknown";
}

function extractActions(content: string): string[] {
  const actions: string[] = [];
  const regex = /action:\s*["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(content)) !== null) {
    if (m[1]) actions.push(m[1]);
  }
  return actions;
}

function hasFile(dir: string, ...parts: string[]): boolean {
  return existsSync(join(dir, ...parts));
}

// ---------------------------------------------------------------------------
// Integrations AGENTS.md
// ---------------------------------------------------------------------------

interface IntegrationInfo {
  id: string;
  name: string;
  description: string;
  authType: string;
  category: string;
  actions: string[];
  hasWebhook: boolean;
  hasDelta: boolean;
  hasMcp: boolean;
}

function scanIntegrations(): IntegrationInfo[] {
  const srcDir = join(ROOT, "packages/integrations/src");
  const dirs = readdirSync(srcDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .map((d) => d.name)
    .sort();

  return dirs.map((id) => {
    const dir = join(srcDir, id);
    const indexContent =
      readFile(join(dir, "index.ts")) || readFile(join(dir, "index.tsx"));
    const dsContent = readFile(join(dir, "api/data-sources.ts"));

    return {
      id,
      name: extractQuoted(indexContent, "name") ?? id,
      description: extractQuoted(indexContent, "description") ?? "",
      authType: extractAuthType(indexContent),
      category: extractCategory(indexContent),
      actions: extractActions(dsContent),
      hasWebhook: hasFile(dir, "events", "webhook.ts"),
      hasDelta: hasFile(dir, "events", "delta.ts"),
      hasMcp: hasFile(dir, "mcp", "mcp-tools.ts"),
    };
  });
}

function generateIntegrationsAgentsMd(integrations: IntegrationInfo[]): string {
  const rows = integrations
    .map((i) => {
      const actions = i.actions.length > 0 ? i.actions.join(", ") : "_(none)_";
      const webhook = i.hasWebhook ? "yes" : "-";
      const delta = i.hasDelta ? "yes" : "-";
      return `| \`${i.id}\` | ${i.authType} | ${i.category} | ${actions} | ${webhook} | ${delta} |`;
    })
    .join("\n");

  return `# Integrations Package — Agent Reference

> Auto-generated. Regenerate with \`pnpm generate-agents-md\`.

## Overview

\`@radarboard/integrations\` provides the integration layer between external services and the dashboard. Each integration is a self-contained directory under \`src/\` with a predictable structure.

## Package Exports

All external imports use \`@radarboard/integrations/<integration>/<module>\` paths resolved via \`package.json\` exports. Internal file paths may differ — always use the package export alias.

## Canonical Directory Structure

\`\`\`
<integration>/
├── index.ts          # IntegrationDescriptor (id, name, auth, dataSources)
├── types.ts          # Config & API response types
├── README.md
├── api/
│   ├── client.ts     # HTTP/GraphQL API client
│   └── data-sources.ts # DataSourceDescriptor[] for /api/integrations/[id]/[action]
├── events/           # (optional — only for webhook-capable integrations)
│   ├── webhook.ts    # WebhookHandler (signature verification + payload parsing)
│   └── delta.ts      # DeltaDetector (change detection on fresh data)
└── mcp/
    ├── mcp-tools.ts       # IntegrationMcpTool[] definitions
    └── mcp-tools.test.ts  # Tool validation tests
\`\`\`

## Key Types (src/types.ts)

| Type | Purpose |
|------|---------|
| \`IntegrationDescriptor\` | Full integration definition: id, name, description, icon, category, auth, dataSources |
| \`IntegrationAuth\` | Auth config: type (\`api_key\` / \`oauth\` / \`none\`), fields, testEndpoint, docsUrl |
| \`DataSourceDescriptor\` | Fetchable endpoint: action, cacheTtlSeconds, buildCacheKey, fetch(), delta |
| \`CommonRouteParams\` | Standard query params: projectSlug, range, timeZone, forceRefresh |
| \`DataSourceContext\` | Injected services: resolveCredential, getProjectIntegrations, getMcpClient |
| \`WebhookHandler\` | Inbound webhook: verifySignature(), parsePayload() |
| \`DeltaDetector<T>\` | Change detection: detect(current, projectSlug) → IntegrationEvent[] |
| \`IntegrationEvent\` | Notification event: source, type, severity, title, body, metadata |

## Integration Registry

All integrations are registered in \`src/init.ts\` via \`registerIntegration(descriptor)\`. The registry is a \`Map<string, IntegrationDescriptor>\`.

## Integration Summary

| Integration | Auth | Category | Data Source Actions | Webhooks | Delta |
|---|---|---|---|---|---|
${rows}

## Data Flow

1. **API route** \`/api/integrations/[integration]/[action]\` receives request
2. Routes to matching \`DataSourceDescriptor.fetch()\` via action slug
3. \`fetch()\` calls \`ctx.resolveCredential(integrationId)\` to get stored API keys
4. Client functions make external API calls
5. Response is cached via \`withCache(buildCacheKey(), cacheTtlSeconds)\`
6. Optional \`delta.detector.detect()\` emits \`IntegrationEvent[]\` for notifications

## Adding a New Integration

\`\`\`bash
pnpm create-integration <name>
\`\`\`

This scaffolds from \`_template/\` with the canonical structure. Then:
1. Implement \`api/client.ts\`
2. Configure auth fields in \`index.ts\`
3. Add data sources in \`api/data-sources.ts\`
4. Register in \`src/init.ts\`
5. Add exports to \`package.json\`
`;
}

// ---------------------------------------------------------------------------
// Widgets AGENTS.md
// ---------------------------------------------------------------------------

interface WidgetInfo {
  id: string;
  name: string;
  description: string;
  defaultSlot: string;
  hasExpanded: boolean;
  hasHooks: boolean;
  hasMcp: boolean;
  hasTests: boolean;
  requiredIntegrations: string[];
}

function scanWidgets(): WidgetInfo[] {
  const srcDir = join(ROOT, "packages/widgets/src/widgets");
  const dirs = readdirSync(srcDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .map((d) => d.name)
    .sort();

  return dirs.map((id) => {
    const dir = join(srcDir, id);
    const indexContent =
      readFile(join(dir, "index.ts")) || readFile(join(dir, "index.tsx"));

    // Extract required integrations array
    const intMatch = indexContent.match(/requiredIntegrations:\s*\[([^\]]*)\]/);
    const integrations = intMatch?.[1]
      ? intMatch[1]
          .split(",")
          .map((s) => s.trim().replace(/["']/g, ""))
          .filter(Boolean)
      : [];

    const slotMatch = indexContent.match(/defaultSlot:\s*["'](\w+)["']/);

    return {
      id,
      name: extractQuoted(indexContent, "name") ?? id,
      description: extractQuoted(indexContent, "description") ?? "",
      defaultSlot: slotMatch?.[1] ?? "unknown",
      hasExpanded: hasFile(dir, "components", `${id}-expanded.tsx`),
      hasHooks: hasFile(dir, "hooks"),
      hasMcp: hasFile(dir, "mcp", "mcp-tools.ts"),
      hasTests: hasFile(dir, "__tests__"),
      requiredIntegrations: integrations,
    };
  });
}

function generateWidgetsAgentsMd(widgets: WidgetInfo[]): string {
  const rows = widgets
    .map((w) => {
      const integrations =
        w.requiredIntegrations.length > 0 ? w.requiredIntegrations.join(", ") : "_(none)_";
      const expanded = w.hasExpanded ? "yes" : "-";
      return `| \`${w.id}\` | ${w.defaultSlot} | ${integrations} | ${expanded} |`;
    })
    .join("\n");

  return `# Widgets Package — Agent Reference

> Auto-generated. Regenerate with \`pnpm generate-agents-md\`.

## Overview

\`@radarboard/widget-engine\` provides the dashboard widget system. Each widget is a self-contained directory under \`src/widgets/\` with a predictable structure. Widgets are rendered in a 3x3 grid (9 slots) with compact and expanded views.

## Canonical Directory Structure

\`\`\`
<widget>/
├── index.ts          # WidgetDescriptor (id, name, component, config, auth)
├── types.ts          # Widget-specific config & data types
├── README.md
├── components/
│   ├── <widget>-compact.tsx    # Compact grid view
│   └── <widget>-expanded.tsx   # Expanded overlay view
├── hooks/
│   └── use-<widget>.ts         # SWR-based data fetching hook
├── mcp/
│   ├── mcp-tools.ts            # MCP tool definitions
│   └── mcp-tools.test.ts       # Tool validation tests
└── __tests__/
    └── <widget>.test.tsx        # Component integration tests
\`\`\`

## Key Types (src/widgets/types.ts)

| Type | Purpose |
|------|---------|
| \`WidgetDescriptor<TConfig>\` | Full widget definition: id, name, component, defaultConfig, auth, polling |
| \`WidgetRenderProps\` | Props passed to compact component: projectSlug, timeRange, config, onRefetch |
| \`GridSlot\` | Grid position: \`slot1\` through \`slot9\` |
| \`WidgetAuth\` | Auth requirement: integrationId, type, scopes, label |
| \`WidgetPollingConfig<T>\` | Dynamic polling: sourceIds, getInterval(config) |
| \`WidgetVisualEditorBinding\` | Visual editor config: kind, getConfig, setConfig |

## Widget Registry

All widgets are registered in \`src/init.ts\` via \`registerWidget(descriptor)\`. The registry is a \`Map<string, WidgetDescriptor>\`.

## Widget Summary

| Widget | Default Slot | Required Integrations | Expanded |
|---|---|---|---|
${rows}

## Template System

Most widgets use the **template system** (\`src/templates/\`) which provides declarative, config-driven rendering:

### WidgetTemplateConfig

\`\`\`typescript
{
  dataSources: DataSourceDeclaration[];  // What data to fetch: [{ id: "revenue" }]
  sections: SectionConfig[];              // Compact view layout
  expandedSections?: SectionConfig[];     // Expanded view layout
}
\`\`\`

### Available Section Types

\`alert\`, \`headline-stat\`, \`kpi-row\`, \`summary-quad\`, \`list\`, \`row-list\`, \`stream-list\`, \`filter-bar\`, \`dense-ranked-table\`, \`table\`, \`chart\`, \`activity-chart\`, \`tabs\`, \`stack\`, \`grid\`, \`split\`

## Hooks Pattern

Widget hooks follow a consistent pattern using SWR for caching and polling:

\`\`\`typescript
export function useWidgetData(projectSlug, config) {
  const refreshInterval = usePollingInterval("source-id");
  const { data, error, isLoading, mutate } = useSWR(key, fetcher, { refreshInterval });
  const refetch = useCallback(async () => { /* force refresh with ?refresh=1 */ }, [mutate]);
  return { data, loading, error, refetch, fetchedAt };
}
\`\`\`

## Adding a New Widget

\`\`\`bash
pnpm create-widget <name>
\`\`\`

This scaffolds from \`_template/\` with the canonical structure. Then:
1. Define the descriptor in \`index.ts\`
2. Create compact/expanded components
3. Add data-fetching hook
4. Register in \`src/init.ts\`
`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const integrations = scanIntegrations();
const widgets = scanWidgets();

const intMd = generateIntegrationsAgentsMd(integrations);
const widMd = generateWidgetsAgentsMd(widgets);

writeFileSync(join(ROOT, "packages/integrations/AGENTS.md"), intMd);
writeFileSync(join(ROOT, "packages/widgets/AGENTS.md"), widMd);

console.log(`Generated AGENTS.md for ${integrations.length} integrations and ${widgets.length} widgets.`);
