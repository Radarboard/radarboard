import Image from "next/image";
import { getFaviconUrl, type Integration } from "@/data/integrations";

interface IntegrationCardProps {
  integration: Integration;
}

export function IntegrationCard({ integration }: IntegrationCardProps) {
  return (
    <a
      href={integration.url}
      target="_blank"
      rel="noopener noreferrer"
      className="overflow-hidden border border-border bg-surface p-5 transition-interactive hover:border-accent"
    >
      <div className="flex items-start gap-4">
        {integration.domain ? (
          <div className="size-11 shrink-0 overflow-hidden border border-border bg-background">
            <Image
              src={getFaviconUrl(integration.domain, 64)}
              alt={integration.name}
              width={44}
              height={44}
              loading="lazy"
              className="size-full object-cover"
            />
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-foreground text-w-base">{integration.name}</h3>
          <p className="mt-2 text-muted text-w-sm leading-relaxed">{integration.description}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-px border border-border bg-border sm:grid-cols-2">
        <div className="bg-background p-4">
          <div className="mono-label text-muted">Auth</div>
          <div className="mt-2 text-foreground text-w-sm">{integration.authModes.join(", ")}</div>
        </div>
        <div className="bg-background p-4">
          <div className="mono-label text-muted">Best for</div>
          <div className="mt-2 text-foreground text-w-sm">{integration.bestFor.join(", ")}</div>
        </div>
      </div>

      <div className="mt-5">
        <div className="mono-label mb-3 text-muted">Signals</div>
        <div className="flex flex-wrap gap-2">
          {integration.signals.map((signal) => (
            <span
              key={signal}
              className="border border-border bg-background px-2.5 py-1 text-foreground text-w-xs"
            >
              {signal}
            </span>
          ))}
        </div>
      </div>
    </a>
  );
}
