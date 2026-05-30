import type { NoteTemplate } from "./types";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export const BUILT_IN_TEMPLATES: NoteTemplate[] = [
  {
    id: "tpl-meeting",
    name: "Meeting Notes",
    description: "Structured meeting notes with attendees, agenda, and action items",
    content: `## Meeting: [Topic]

**Date:** ${"{date}"}
**Attendees:**

### Agenda
1.

### Notes

### Action Items
- [ ]
`,
    tags: ["meeting"],
    icon: "users",
    builtIn: true,
    order: 0,
  },
  {
    id: "tpl-incident",
    name: "Incident Report",
    description: "Document incidents with timeline, impact, and resolution",
    content: `## Incident Report

**Severity:** P1 / P2 / P3
**Status:** Investigating / Mitigated / Resolved
**Date:** ${"{date}"}

### Summary

### Timeline
- **HH:MM** —

### Impact

### Root Cause

### Resolution

### Follow-up Actions
- [ ]
`,
    tags: ["incident"],
    icon: "alertTriangle",
    builtIn: true,
    order: 1,
  },
  {
    id: "tpl-daily",
    name: "Daily Log",
    description: "Quick daily standup or journal entry",
    content: `## Daily Log — ${"{date}"}

### Done Today
-

### In Progress
-

### Blockers
-

### Notes
`,
    tags: ["daily"],
    icon: "calendar",
    builtIn: true,
    order: 2,
  },
  {
    id: "tpl-technical",
    name: "Technical Doc",
    description: "Document a system, API, or technical decision",
    content: `# [Title]

## Overview

## Architecture

## API / Interface

\`\`\`typescript
// Example
\`\`\`

## Configuration

## Troubleshooting
`,
    tags: ["docs"],
    icon: "fileCode",
    builtIn: true,
    order: 3,
  },
];

/**
 * Hydrate a template body by replacing `{date}` placeholders.
 */
export function hydrateTemplate(content: string): string {
  return content.replace(/\{date\}/g, today());
}

/**
 * Merge built-in templates with user-created ones.
 * User templates with the same id as a built-in override it.
 */
export function mergeTemplates(userTemplates: NoteTemplate[]): NoteTemplate[] {
  const userIds = new Set(userTemplates.map((t) => t.id));
  const builtIns = BUILT_IN_TEMPLATES.filter((t) => !userIds.has(t.id));
  return [...builtIns, ...userTemplates].sort((a, b) => a.order - b.order);
}
