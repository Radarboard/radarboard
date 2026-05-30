# Domain Health

Domain verification and configuration status across Vercel projects

## Required Integrations

- `vercel`

## Structure

```
vercel-domains/
├── index.ts              # Widget descriptor
├── types.ts              # Widget-specific types
├── components/
│   ├── vercel-domains-compact.tsx
│   └── vercel-domains-expanded.tsx
├── hooks/
│   └── use-vercel-domains.ts
├── mcp/
│   ├── mcp-tools.ts
│   └── mcp-tools.test.ts
└── __tests__/
    └── vercel-domains.test.tsx
```
