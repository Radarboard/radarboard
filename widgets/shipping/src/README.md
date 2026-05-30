# Shipping Log

Recent deploys, commits, and shipped features

## Required Integrations

None

## Structure

```
shipping/
├── index.ts              # Widget descriptor
├── types.ts              # Widget-specific types
├── components/
│   ├── shipping-compact.tsx
│   ├── shipping-expanded.tsx
│   └── shipping-log.tsx
├── hooks/
│   └── use-shipping.ts
├── mcp/
│   ├── mcp-tools.ts
│   └── mcp-tools.test.ts
└── __tests__/
    └── shipping.test.tsx
```
