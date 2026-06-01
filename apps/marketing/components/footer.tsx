import { site } from "@/data/site";

const productLinks = [
  { href: "/", label: "Home", external: false },
  { href: "/integrations", label: "Integrations", external: false },
  { href: "/widgets", label: "Widgets", external: false },
  { href: site.links.docs, label: "Docs", external: true },
] as const;

const projectLinks = [
  { href: site.links.github, label: "GitHub", external: true },
  { href: site.links.x, label: "X", external: true },
  { href: site.company.url, label: site.company.name, external: true },
] as const;

const legalLinks = [
  { href: "/terms", label: "Terms", external: false },
  { href: "/privacy", label: "Privacy", external: false },
] as const;

function FooterLinkGroup({
  title,
  links,
}: {
  title: string;
  links: readonly { href: string; label: string; external: boolean }[];
}) {
  return (
    <div className="min-w-0">
      <div className="eyebrow mb-4 text-muted">{title}</div>
      <ul className="space-y-3">
        {links.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              target={link.external ? "_blank" : undefined}
              rel={link.external ? "noopener noreferrer" : undefined}
              className="text-foreground text-w-sm transition-interactive hover:text-accent"
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="w-full border-border border-t bg-background px-4 pt-20 pb-12 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 border-border border-b pb-12 md:grid-cols-4">
          <div className="min-w-0 space-y-5">
            <div className="font-semibold text-foreground text-w-lg">{site.name}</div>
            <p className="max-w-md text-muted text-w-sm leading-relaxed">
              {site.name} gives {site.audiencesLabel} one place to track revenue, releases, growth,
              reliability, open-source, and operations without bouncing between tools.
            </p>
          </div>

          <FooterLinkGroup title="Product" links={productLinks} />
          <FooterLinkGroup title="Project" links={projectLinks} />
          <FooterLinkGroup title="Legal" links={legalLinks} />
        </div>

        <div className="flex flex-col gap-3 pt-6 text-muted text-w-xs md:flex-row md:items-center md:justify-between">
          <div>(c) 2026 Radarboard</div>
          <div>
            Built by{" "}
            <a
              href={site.company.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground transition-interactive hover:text-accent"
            >
              {site.company.name}
            </a>{" "}
            for builders and teams running real software.
          </div>
        </div>
      </div>
    </footer>
  );
}
