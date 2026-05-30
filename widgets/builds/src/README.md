# Build Performance

Build time trends and performance across Vercel deployments

## Required Integrations

- `vercel`

## Structure

```
vercel-build-perf/
├── index.ts              # Widget descriptor
├── types.ts              # Widget-specific types
├── components/
│   ├── vercel-build-perf-compact.tsx
│   └── vercel-build-perf-expanded.tsx
├── hooks/
│   └── use-vercel-deployments.ts
├── mcp/
│   ├── mcp-tools.ts
│   └── mcp-tools.test.ts
└── __tests__/
    └── vercel-build-perf.test.tsx
```
