/**
 * Mock data for plugins in demo mode.
 * Each plugin's hook checks useDemoMode() and returns these when active.
 */

export interface MockTask {
  id: string;
  title: string;
  completed: boolean;
  priority: "high" | "medium" | "low";
  createdAt: string;
}

export const MOCK_TASKS: MockTask[] = [
  {
    id: "demo-task-1",
    title: "Review Q1 analytics report",
    completed: false,
    priority: "high",
    createdAt: "2026-03-25T10:00:00Z",
  },
  {
    id: "demo-task-2",
    title: "Update landing page copy",
    completed: true,
    priority: "medium",
    createdAt: "2026-03-24T14:00:00Z",
  },
  {
    id: "demo-task-3",
    title: "Set up Stripe webhook for refunds",
    completed: false,
    priority: "low",
    createdAt: "2026-03-23T09:00:00Z",
  },
  {
    id: "demo-task-4",
    title: "Deploy v2.1 to production",
    completed: true,
    priority: "high",
    createdAt: "2026-03-22T16:00:00Z",
  },
  {
    id: "demo-task-5",
    title: "Write API documentation for /billing endpoint",
    completed: false,
    priority: "medium",
    createdAt: "2026-03-21T11:00:00Z",
  },
];

export interface MockNote {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
}

export const MOCK_NOTES: MockNote[] = [
  {
    id: "demo-note-1",
    title: "Sprint 14 retrospective",
    content:
      "## What went well\n- Shipped revenue widget ahead of schedule\n- Zero regressions in SEO module\n\n## What to improve\n- PR review turnaround still slow",
    updatedAt: "2026-03-25T15:00:00Z",
  },
  {
    id: "demo-note-2",
    title: "API design decisions",
    content:
      "### Webhook payload format\nUsing CloudEvents spec for all webhook payloads. This gives us standardized metadata headers.",
    updatedAt: "2026-03-24T10:00:00Z",
  },
  {
    id: "demo-note-3",
    title: "Onboarding flow ideas",
    content:
      "- Show demo data first, let users explore\n- Badge in header indicates demo mode\n- One-click transition to real setup",
    updatedAt: "2026-03-23T08:00:00Z",
  },
];

export interface MockBookmark {
  id: string;
  title: string;
  url: string;
  tags: string[];
  createdAt: string;
}

export const MOCK_BOOKMARKS: MockBookmark[] = [
  {
    id: "demo-bm-1",
    title: "Vercel Edge Functions docs",
    url: "https://vercel.com/docs/functions/edge-functions",
    tags: ["docs", "vercel"],
    createdAt: "2026-03-25T12:00:00Z",
  },
  {
    id: "demo-bm-2",
    title: "Stripe Billing API reference",
    url: "https://stripe.com/docs/api/subscriptions",
    tags: ["docs", "stripe"],
    createdAt: "2026-03-24T09:00:00Z",
  },
  {
    id: "demo-bm-3",
    title: "React 19 release notes",
    url: "https://react.dev/blog/2024/12/05/react-19",
    tags: ["react", "release"],
    createdAt: "2026-03-23T14:00:00Z",
  },
  {
    id: "demo-bm-4",
    title: "Tailwind CSS v4 migration guide",
    url: "https://tailwindcss.com/docs/upgrade-guide",
    tags: ["css", "migration"],
    createdAt: "2026-03-22T11:00:00Z",
  },
];
