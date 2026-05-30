# SEO Performance

Search queries, click trends, impressions, and ranking positions

## Required Integrations

None

## Structure

```
seo/
├── index.ts              # Widget descriptor
├── types.ts              # Widget-specific types
├── components/
│   ├── seo-compact.tsx
│   ├── seo-expanded.tsx
│   └── seo-queries.tsx
├── hooks/
│   ├── use-seo.ts
│   └── use-seo-query.ts
├── mcp/
│   ├── mcp-tools.ts
│   └── mcp-tools.test.ts
└── __tests__/
    └── seo.test.tsx
```
