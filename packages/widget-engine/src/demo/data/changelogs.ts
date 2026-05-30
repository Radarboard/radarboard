// --- Changelogs ---
export interface MockChangelogEntry {
  id: string;
  title: string;
  version: string;
  packageName: string;
  date: string;
  notesQuality: "full" | "minimal";
  releaseUrl: string | null;
  publishedAt: string;
  isPrerelease: boolean;
}

export const MOCK_CHANGELOGS: MockChangelogEntry[] = [
  {
    id: "cl-1",
    title: "next",
    version: "v16.2.1",
    packageName: "next",
    date: "2026-03-20",
    notesQuality: "full",
    releaseUrl: "https://github.com/vercel/next.js/releases/tag/v16.2.1",
    publishedAt: "2026-03-20T12:00:00Z",
    isPrerelease: false,
  },
  {
    id: "cl-2",
    title: "resend",
    version: "v6.9.4",
    packageName: "resend",
    date: "2026-03-16",
    notesQuality: "full",
    releaseUrl: "https://github.com/resend/resend-node/releases/tag/v6.9.4",
    publishedAt: "2026-03-16T08:30:00Z",
    isPrerelease: false,
  },
  {
    id: "cl-3",
    title: "shiki",
    version: "v4.0.2",
    packageName: "shiki",
    date: "2026-03-09",
    notesQuality: "full",
    releaseUrl: "https://github.com/shikijs/shiki/releases/tag/v4.0.2",
    publishedAt: "2026-03-09T14:00:00Z",
    isPrerelease: false,
  },
  {
    id: "cl-4",
    title: "nuqs",
    version: "v2.8.9",
    packageName: "nuqs",
    date: "2026-02-27",
    notesQuality: "full",
    releaseUrl: "https://github.com/47ng/nuqs/releases/tag/v2.8.9",
    publishedAt: "2026-02-27T10:15:00Z",
    isPrerelease: false,
  },
  {
    id: "cl-5",
    title: "zod",
    version: "v4.3.6",
    packageName: "zod",
    date: "2026-01-22",
    notesQuality: "full",
    releaseUrl: "https://github.com/colinhacks/zod/releases/tag/v4.3.6",
    publishedAt: "2026-01-22T16:00:00Z",
    isPrerelease: false,
  },
];
