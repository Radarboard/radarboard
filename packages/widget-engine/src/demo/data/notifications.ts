/**
 * Mock notifications for demo mode.
 */

export interface MockNotification {
  id: string;
  title: string;
  body: string;
  source: string;
  read: boolean;
  createdAt: string;
  url?: string;
}

export const MOCK_NOTIFICATIONS: MockNotification[] = [
  {
    id: "demo-notif-1",
    title: "PR #142 merged",
    body: "feat(editor): add layer blending modes to canvas",
    source: "github",
    read: false,
    createdAt: "2026-03-26T09:15:00Z",
    url: "https://github.com/acme/pixel-studio/pull/142",
  },
  {
    id: "demo-notif-2",
    title: "Deployment succeeded",
    body: "Production deployment completed in 45s — pixel-studio.vercel.app",
    source: "vercel",
    read: false,
    createdAt: "2026-03-26T08:30:00Z",
  },
  {
    id: "demo-notif-3",
    title: "Revenue milestone",
    body: "Pixel Studio crossed $4,000 MRR — up 12% from last month",
    source: "stripe",
    read: true,
    createdAt: "2026-03-25T18:00:00Z",
  },
  {
    id: "demo-notif-4",
    title: "New issue opened",
    body: "#89: Mobile layout breaks on iPad mini viewport",
    source: "github",
    read: true,
    createdAt: "2026-03-25T14:20:00Z",
    url: "https://github.com/acme/pixel-studio/issues/89",
  },
  {
    id: "demo-notif-5",
    title: "SEO ranking improved",
    body: "pixelstudio.app moved from position 8 to 3 for 'image editor online'",
    source: "google-search-console",
    read: true,
    createdAt: "2026-03-25T06:00:00Z",
  },
];
