# Logs

Structured application logs with real-time streaming

## Required Integrations

None

## Structure

```
logs/
├── index.ts              # Widget descriptor
├── types.ts              # Widget-specific types
├── components/
│   ├── logs-compact.tsx
│   ├── logs-expanded.tsx
│   ├── log-entry.tsx
│   ├── log-filters.tsx
│   └── logs-visual-editor.tsx
├── hooks/
│   └── use-logs.ts
├── mcp/
│   ├── mcp-tools.ts
│   └── mcp-tools.test.ts
└── __tests__/
    └── logs.test.tsx
```
