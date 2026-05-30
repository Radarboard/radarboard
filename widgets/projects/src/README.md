# Project Status

Live deployment status across all Vercel projects

## Required Integrations

- `vercel`

## Structure

```
vercel-projects/
├── index.ts              # Widget descriptor
├── types.ts              # Widget-specific types
├── components/
│   ├── vercel-projects-compact.tsx
│   └── vercel-projects-expanded.tsx
├── hooks/
│   └── use-vercel-deployments.ts
├── mcp/
│   ├── mcp-tools.ts
│   └── mcp-tools.test.ts
└── __tests__/
    └── vercel-projects.test.tsx
```
