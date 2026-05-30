import type { AssistantArtifactRow } from "@radarboard/types/database";
import { RichTextViewer } from "@radarboard/ui/rich-text-viewer";
import { AlertTriangleIcon, BracesIcon, FileCode2Icon, Link2Icon } from "lucide-react";
import { useEffect, useState } from "react";

function extractMermaidSource(body: string): string {
  const trimmed = body.trim();
  if (trimmed.startsWith("```mermaid")) {
    return trimmed
      .replace(/^```mermaid\s*/i, "")
      .replace(/```$/, "")
      .trim();
  }
  return trimmed;
}

function buildHtmlDocument(body: string): string {
  const trimmed = body.trim();
  if (/^<!doctype html/i.test(trimmed) || /^<html/i.test(trimmed)) return trimmed;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 16px;
        background: #0b0d10;
        color: #d7dae0;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        overflow-wrap: anywhere;
      }
      img, svg, canvas, iframe, video { max-width: 100%; height: auto; }
      table { width: 100%; table-layout: fixed; }
    </style>
  </head>
  <body>${body}</body>
</html>`;
}

function MermaidPreview({ source }: { source: string }) {
  const [{ svgDoc, error }, setRenderState] = useState<{
    svgDoc: string | null;
    error: string | null;
  }>({
    svgDoc: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "dark",
        });
        const { svg: nextSvg } = await mermaid.render(
          `artifact-mermaid-${crypto.randomUUID()}`,
          source
        );
        if (!cancelled) {
          setRenderState({
            svgDoc: buildHtmlDocument(nextSvg),
            error: null,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setRenderState({
            svgDoc: null,
            error: err instanceof Error ? err.message : "Failed to render Mermaid diagram.",
          });
        }
      }
    }

    render().catch(() => {
      /* fire-and-forget */
    });
    return () => {
      cancelled = true;
    };
  }, [source]);

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-item border border-red-500/20 bg-red-500/5 px-3 py-2 font-mono text-red-300 text-w-sm">
        <AlertTriangleIcon size={12} />
        {error}
      </div>
    );
  }

  if (!svgDoc) {
    return (
      <div className="font-mono text-[var(--color-text-muted)] text-w-sm">Rendering diagram…</div>
    );
  }

  return (
    <iframe
      title="Mermaid preview"
      srcDoc={svgDoc}
      sandbox=""
      className="h-widget-md w-full rounded-item border border-[var(--color-border)] bg-[#0b0d10]"
    />
  );
}

export function ChatArtifactPreview({ artifact }: { artifact: AssistantArtifactRow }) {
  const evidenceContent =
    artifact.evidenceRefs.length > 0 ? (
      <div className="space-y-2">
        <div className="flex items-center gap-1 font-mono text-[var(--color-text-muted)] text-w-sm uppercase tracking-widest">
          <Link2Icon size={11} />
          Evidence
          <span className="rounded-item border border-[var(--color-border)] px-1.5 py-0.5 text-[var(--color-text-muted)] text-w-sm">
            {artifact.evidenceRefs.length}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5 overflow-x-hidden">
          {artifact.evidenceRefs.map((ref) => {
            const content = (
              <>
                <span className="shrink-0 rounded-item border border-[var(--color-border)] px-1 py-0.5 text-[var(--color-text-muted)] text-w-sm uppercase tracking-widest">
                  {ref.kind}
                </span>
                <span className="truncate">{ref.label}</span>
              </>
            );

            return ref.url ? (
              <a
                key={`${ref.kind}:${ref.label}:${ref.url ?? ""}`}
                href={ref.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-item border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 font-mono text-[var(--color-text-muted)] text-w-sm transition-colors hover:border-[var(--color-accent)]/30 hover:text-[var(--color-text)]"
              >
                {content}
              </a>
            ) : (
              <span
                key={`${ref.kind}:${ref.label}:${ref.url ?? ""}`}
                className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-item border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 font-mono text-[var(--color-text-muted)] text-w-sm"
              >
                {content}
              </span>
            );
          })}
        </div>
      </div>
    ) : null;

  if (artifact.contentType === "html") {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-1 font-mono text-[var(--color-text-muted)] text-w-sm uppercase tracking-widest">
          <FileCode2Icon size={11} />
          HTML Preview
        </div>
        <iframe
          title={artifact.title}
          srcDoc={buildHtmlDocument(artifact.body)}
          sandbox=""
          className="h-widget-md w-full rounded-item border border-[var(--color-border)] bg-white"
        />
        {evidenceContent}
      </div>
    );
  }

  if (artifact.contentType === "mermaid") {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-1 font-mono text-[var(--color-text-muted)] text-w-sm uppercase tracking-widest">
          <BracesIcon size={11} />
          Mermaid Preview
        </div>
        <MermaidPreview source={extractMermaidSource(artifact.body)} />
        {evidenceContent}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <RichTextViewer markdown={artifact.body} className="text-w-sm" />
      {evidenceContent}
    </div>
  );
}
