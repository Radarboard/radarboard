# Sponsorship

Unified sponsorship view -- sponsors, backers, and donation metrics from Open Collective and GitHub Sponsors

## Required Integrations

None

## Structure

```
sponsorship/
├── index.ts              # Widget descriptor
├── types.ts              # Widget-specific types
├── components/
│   ├── sponsorship-compact.tsx
│   └── sponsorship-expanded.tsx
├── hooks/
│   ├── use-github-sponsors.ts
│   └── use-open-collective.ts
├── mcp/
│   ├── mcp-tools.ts
│   └── mcp-tools.test.ts
└── __tests__/
    └── sponsorship.test.tsx
```
