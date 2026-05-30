import { cn } from "@radarboard/utils/cn";
import { Info, Lightbulb, ShieldAlert, TriangleAlert } from "lucide-react";
import type React from "react";
import { Children, createContext, isValidElement, useContext } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChangelogEntry } from "../../types";

const ListTypeCtx = createContext<"ul" | "ol">("ul");
const OlIndexCtx = createContext<{ next: () => number }>({ next: () => 1 });

function inferBodyFormat(entry: ChangelogEntry, body: string): ChangelogEntry["bodyFormat"] {
  if (entry.bodyFormat) return entry.bodyFormat;
  if (entry.sourceType === "github_release") return "markdown";
  if (entry.sourceType === "github_atom" && /<[a-z][\s\S]*>/i.test(body)) return "html";
  return "text";
}

function normalizeGitHubAlerts(markdown: string): string {
  return markdown.replace(
    /^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/gim,
    (_match, label: string) => `> **${label.charAt(0)}${label.slice(1).toLowerCase()}**\n>`
  );
}

function linkifyGitHubMentions(markdown: string): string {
  return markdown.replace(
    /(?<!\[)@([a-zA-Z\d](?:[a-zA-Z\d-]*[a-zA-Z\d])?)(?![/\w])/g,
    "[@$1](https://github.com/$1)"
  );
}

function shortenGitHubUrl(href: string): string | null {
  try {
    const url = new URL(href);
    if (url.hostname !== "github.com") return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length >= 4 && (parts[2] === "pull" || parts[2] === "issues")) {
      return `#${parts[3]}`;
    }
    if (parts.length >= 4 && parts[2] === "commit") {
      return parts[3]?.slice(0, 7) ?? null;
    }
    if (parts.length >= 3 && parts[2] === "compare") {
      return parts[3] ?? parts[2];
    }
  } catch {
    /* not a URL */
  }
  return null;
}

function extractPlainText(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractPlainText).join("");
  if (isValidElement<{ children?: React.ReactNode }>(node)) {
    return extractPlainText(node.props.children);
  }
  return "";
}

function alertMetaFromTitle(title: string): {
  tone: string;
  icon: React.ReactNode;
  label: string;
} | null {
  const normalized = title.trim().toLowerCase();
  switch (normalized) {
    case "note":
      return {
        tone: "border-info/30 bg-info-bg text-foreground",
        icon: <Info className="icon-sm text-info" />,
        label: "Note",
      };
    case "tip":
      return {
        tone: "border-success/30 bg-success-bg text-foreground",
        icon: <Lightbulb className="icon-sm text-success" />,
        label: "Tip",
      };
    case "important":
      return {
        tone: "border-accent/30 bg-accent/10 text-foreground",
        icon: <ShieldAlert className="icon-sm text-accent" />,
        label: "Important",
      };
    case "warning":
    case "caution":
      return {
        tone: "border-warning/30 bg-warning-bg text-foreground",
        icon: <TriangleAlert className="icon-sm text-warning" />,
        label: normalized === "warning" ? "Warning" : "Caution",
      };
    default:
      return null;
  }
}

function MarkdownListItem({ children }: { children: React.ReactNode }) {
  const listType = useContext(ListTypeCtx);
  const indexer = useContext(OlIndexCtx);
  const marker = listType === "ol" ? `${indexer.next()}.` : "•";
  return (
    <div className="flex gap-2 text-foreground text-w-base leading-5">
      <span className="shrink-0 select-none text-foreground-secondary">{marker}</span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}

function MarkdownBlockquote({ children }: { children: React.ReactNode }) {
  const childArray = Children.toArray(children);
  const firstChild = childArray[0];
  const firstChildText = extractPlainText(firstChild).trim();
  const alertMeta = alertMetaFromTitle(firstChildText);

  if (alertMeta) {
    const contentChildren = childArray.slice(1);
    return (
      <blockquote className={cn("my-5 border px-4 py-3", alertMeta.tone)}>
        <div className="mb-2 flex items-center gap-2 font-mono text-w-sm uppercase tracking-[0.18em]">
          {alertMeta.icon}
          {alertMeta.label}
        </div>
        <div className="[&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
          {contentChildren.length > 0 ? contentChildren : (firstChild ?? null)}
        </div>
      </blockquote>
    );
  }

  return (
    <blockquote className="my-5 border-border border-l-2 pl-4 text-foreground">
      {children}
    </blockquote>
  );
}

export function ReleaseBodyRenderer({ entry }: { entry: ChangelogEntry }) {
  const body = entry.body ?? entry.description;
  const bodyFormat = inferBodyFormat(entry, body);

  if (!body) {
    return <p className="text-dim text-w-base leading-5">No release notes available.</p>;
  }

  if (bodyFormat === "html") {
    const plainTextBody = body
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|section|article|li|ul|ol|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return (
      <p className="whitespace-pre-wrap text-foreground text-w-base leading-5">
        {plainTextBody || body}
      </p>
    );
  }

  if (bodyFormat === "markdown") {
    return (
      <div className="text-foreground text-w-base leading-5">
        <Markdown
          remarkPlugins={[remarkGfm]}
          disallowedElements={["script", "iframe", "style", "link", "object", "embed"]}
          unwrapDisallowed
          skipHtml
          components={{
            h1: ({ children }) => (
              <h1 className="mt-6 mb-3 font-semibold text-foreground text-w-2xl leading-tight tracking-[-0.03em] first:mt-0">
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="mt-5 mb-2 font-semibold text-foreground text-w-xl leading-tight">
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="mt-5 mb-2 font-semibold text-foreground-secondary text-w-base uppercase tracking-[0.22em]">
                {children}
              </h3>
            ),
            p: ({ children }) => (
              <p className="my-3 text-foreground text-w-base leading-5">{children}</p>
            ),
            ul: ({ children }) => (
              <ListTypeCtx.Provider value="ul">
                <div className="my-3 flex flex-col gap-1">{children}</div>
              </ListTypeCtx.Provider>
            ),
            ol: ({ children }) => {
              let counter = 0;
              const indexer = { next: () => ++counter };
              return (
                <ListTypeCtx.Provider value="ol">
                  <OlIndexCtx.Provider value={indexer}>
                    <div className="my-3 flex flex-col gap-1">{children}</div>
                  </OlIndexCtx.Provider>
                </ListTypeCtx.Provider>
              );
            },
            li: ({ children }) => <MarkdownListItem>{children}</MarkdownListItem>,
            blockquote: ({ children }) => <MarkdownBlockquote>{children}</MarkdownBlockquote>,
            a: ({ href, children }) => {
              const shortLabel = href ? shortenGitHubUrl(href) : null;
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent underline decoration-accent/30 underline-offset-4 hover:text-accent/80"
                >
                  {shortLabel ?? children}
                </a>
              );
            },
            strong: ({ children }) => (
              <strong className="font-semibold text-foreground">{children}</strong>
            ),
            code: ({ children }) => (
              <code className="border border-border bg-surface px-1.5 py-0.5 text-w-base text-warning">
                {children}
              </code>
            ),
            pre: ({ children }) => (
              <pre className="my-3 overflow-x-auto border border-border bg-surface p-3 text-w-base leading-5">
                {children}
              </pre>
            ),
            hr: () => <hr className="my-5 border-border" />,
          }}
        >
          {linkifyGitHubMentions(normalizeGitHubAlerts(body))}
        </Markdown>
      </div>
    );
  }

  return <p className="whitespace-pre-wrap text-foreground text-w-base leading-5">{body}</p>;
}
