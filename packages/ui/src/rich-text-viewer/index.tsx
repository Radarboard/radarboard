"use client";

import { cn } from "@radarboard/utils/cn";
import { CheckIcon, CopyIcon } from "lucide-react";
import type React from "react";
import { type ComponentPropsWithoutRef, lazy, Suspense, useRef, useState } from "react";
import Markdown from "react-markdown";

const LazyCodeHighlight = lazy(() => import("./code-highlight"));

function CodeBlock({ children, ...props }: ComponentPropsWithoutRef<"pre">) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  const codeEl = Array.isArray(children)
    ? (children.find((child) => child && typeof child === "object" && "props" in child) as
        | React.ReactElement
        | undefined)
    : (children as React.ReactElement | undefined);
  const className = (codeEl?.props as { className?: string } | undefined)?.className ?? "";
  const langMatch = /language-(\w+)/.exec(className);
  const lang = langMatch?.[1] ?? "";
  const codeText =
    typeof (codeEl?.props as { children?: unknown } | undefined)?.children === "string"
      ? String((codeEl?.props as { children?: string }).children ?? "").replace(/\n$/, "")
      : (preRef.current?.textContent ?? "");

  const handleCopy = async () => {
    const text = codeText || preRef.current?.textContent || "";
    const { copyText } = await import("@radarboard/utils/clipboard");
    await copyText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group/code relative my-2 overflow-hidden rounded-item bg-background">
      {Boolean(lang) && (
        <div className="select-none px-3 pt-1.5 pb-0 font-mono text-muted-foreground text-w-sm">
          {lang}
        </div>
      )}
      {lang ? (
        <Suspense
          fallback={
            <pre className="whitespace-pre-wrap break-words p-3 text-w-base leading-relaxed">
              {codeText}
            </pre>
          }
        >
          <LazyCodeHighlight lang={lang} code={codeText} />
        </Suspense>
      ) : (
        <pre
          ref={preRef}
          {...props}
          className="whitespace-pre-wrap break-words p-3 text-w-base leading-relaxed"
        >
          {children}
        </pre>
      )}
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy code"
        className="absolute top-2 right-2 hidden items-center gap-1 rounded-item bg-secondary px-1.5 py-0.5 font-mono text-muted-foreground text-w-sm transition-colors hover:text-foreground group-hover/code:flex"
      >
        {copied ? <CheckIcon size={10} className="text-green-400" /> : <CopyIcon size={10} />}
        {copied ? "copied" : "copy"}
      </button>
    </div>
  );
}

export interface RichTextViewerProps extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
  markdown: string;
}

export function RichTextViewer({ markdown, className, ...props }: RichTextViewerProps) {
  return (
    <div
      className={cn(
        "font-mono text-w-base leading-relaxed",
        "[&_h1]:mt-3 [&_h1]:mb-1 [&_h1]:font-bold [&_h1]:text-w-lg",
        "[&_h2]:mt-2 [&_h2]:mb-1 [&_h2]:font-bold [&_h2]:text-w-lg",
        "[&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:font-bold [&_h3]:text-w-base",
        "[&_p:last-child]:mb-0 [&_p]:mb-2",
        "[&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-4",
        "[&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-4",
        "[&_li]:mb-0.5",
        "[&_code]:rounded-item [&_code]:bg-secondary [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-w-base",
        "[&_pre]:!my-0 [&_pre]:!bg-transparent [&_pre]:!p-0",
        "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
        "[&_blockquote]:border-accent/30 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_blockquote]:italic",
        "[&_a]:text-accent [&_a]:underline",
        "[&_table]:my-2 [&_table]:w-full [&_table]:table-fixed [&_table]:text-w-sm",
        "[&_th]:break-words [&_th]:border-border [&_th]:border-b [&_th]:pr-3 [&_th]:pb-1 [&_th]:text-left",
        "[&_td]:break-words [&_td]:border-border/60 [&_td]:border-b [&_td]:py-1 [&_td]:pr-3",
        "[&_hr]:my-3 [&_hr]:border-border",
        className
      )}
      {...props}
    >
      <Markdown components={{ pre: CodeBlock }}>{markdown}</Markdown>
    </div>
  );
}
