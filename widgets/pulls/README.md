# GitHub Activity

Open pull requests and issues across connected GitHub repositories

## Required Integrations

- `github`

## Structure

```
github-activity/
├── index.ts              # Widget descriptor
├── types.ts              # Widget-specific types
├── components/
│   ├── github-activity-compact.tsx
│   └── github-activity-expanded.tsx
├── hooks/
│   ├── use-github-open-issues.ts
│   └── use-github-open-prs.ts
├── mcp/
│   ├── mcp-tools.ts
│   └── mcp-tools.test.ts
└── __tests__/
    └── github-activity.test.tsx
```
