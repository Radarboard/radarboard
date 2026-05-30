"use client";

import { RichTextViewer } from "@radarboard/ui/rich-text-viewer";

export function ChatMarkdown({ children }: { children: string }) {
  return <RichTextViewer markdown={children} />;
}
