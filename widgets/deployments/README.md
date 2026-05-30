# Deployment Activity

Deploy frequency, success rate, and recent deployments from Vercel

## Required Integrations

- `vercel`

## Structure

```
vercel-deployments/
├── index.ts              # Widget descriptor
├── types.ts              # Widget-specific types
├── components/
│   ├── vercel-deployments-compact.tsx
│   └── vercel-deployments-expanded.tsx
├── hooks/
│   └── use-vercel-deployments.ts
├── mcp/
│   ├── mcp-tools.ts
│   └── mcp-tools.test.ts
└── __tests__/
    └── vercel-deployments.test.tsx
```
