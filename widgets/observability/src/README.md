# Service Monitor

Error tracking, app reviews, uptime monitoring, and service health

## Required Integrations

None

## Structure

```
detail/
├── index.ts              # Widget descriptor
├── types.ts              # Widget-specific types
├── components/
│   ├── detail-compact.tsx
│   ├── detail-expanded.tsx
│   ├── app-store-reviews.tsx
│   ├── health-alerts.tsx
│   ├── health-monitors.tsx
│   └── sentry-issues.tsx
├── hooks/
│   ├── use-app-store.ts
│   └── use-health.ts
├── mcp/
│   ├── mcp-tools.ts
│   └── mcp-tools.test.ts
└── __tests__/
    ├── detail.test.tsx
    ├── app-store-reviews.test.tsx
    ├── health-monitors.test.tsx
    └── sentry-issues.test.tsx
```
