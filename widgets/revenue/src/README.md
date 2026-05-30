# Revenue

Subscription revenue, MRR, and payment metrics

## Required Integrations

None

## Structure

```
revenue/
├── index.ts              # Widget descriptor
├── types.ts              # Widget-specific types
├── components/
│   ├── revenue-compact.tsx
│   ├── revenue-expanded.tsx
│   ├── revenue-chart.tsx
│   └── revenue-kpi.tsx
├── hooks/
│   └── use-revenue.ts
├── mcp/
│   ├── mcp-tools.ts
│   └── mcp-tools.test.ts
└── __tests__/
    └── revenue.test.tsx
```
