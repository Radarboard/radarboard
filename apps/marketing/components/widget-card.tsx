import Image from "next/image";
import { getFaviconUrl, integrations } from "@/data/integrations";
import type { Widget } from "@/data/widgets";

interface WidgetCardProps {
  widget: Widget;
}

export function WidgetCard({ widget }: WidgetCardProps) {
  const linkedIntegrations = widget.integrations.flatMap((slug) => {
    const integration = integrations.find((item) => item.slug === slug);

    return integration ? [integration] : [];
  });

  return (
    <div className="overflow-hidden border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-foreground text-w-lg">{widget.name}</h3>
          <p className="mt-1.5 text-muted text-w-sm leading-relaxed">{widget.description}</p>
        </div>
        <span className="border border-border bg-background px-2.5 py-1 font-mono text-muted text-w-xs">
          {widget.category}
        </span>
      </div>

      <div className="mt-4">
        <div className="mono-label mb-2.5 text-muted">Highlights</div>
        <div className="flex flex-wrap gap-2">
          {widget.highlights.map((highlight) => (
            <span
              key={highlight}
              className="border border-border bg-background px-2.5 py-1 text-foreground text-w-xs"
            >
              {highlight}
            </span>
          ))}
        </div>
      </div>

      {linkedIntegrations.length > 0 && (
        <div className="mt-4 border-border border-t pt-3">
          <div className="mono-label mb-2.5 text-muted">Powered by</div>
          <div className="flex items-center gap-2">
            {linkedIntegrations.map((integration) =>
              integration?.domain ? (
                <div
                  key={integration.slug}
                  className="size-7 overflow-hidden border border-border bg-background"
                  title={integration.name}
                >
                  <Image
                    src={getFaviconUrl(integration.domain, 32)}
                    alt={integration.name}
                    width={28}
                    height={28}
                    loading="lazy"
                    className="size-full object-cover"
                  />
                </div>
              ) : null
            )}
          </div>
        </div>
      )}
    </div>
  );
}
