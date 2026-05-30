# npm Downloads

Weekly and monthly download counts for your npm packages

## Required Integrations

- `npm`

## Structure

```
npm-downloads/
├── index.ts              # Widget descriptor
├── types.ts              # Widget-specific types
├── components/
│   ├── npm-downloads-compact.tsx
│   └── npm-downloads-expanded.tsx
├── hooks/
│   └── use-npm-downloads.ts
├── mcp/
│   ├── mcp-tools.ts
│   └── mcp-tools.test.ts
└── __tests__/
    └── npm-downloads.test.tsx
```
