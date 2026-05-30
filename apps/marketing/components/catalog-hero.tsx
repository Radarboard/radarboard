interface CatalogHeroStat {
  label: string;
  value: string;
}

interface CatalogHeroProps {
  countLabel: string;
  title: string;
  subtitle: string;
  description: string;
  stats: CatalogHeroStat[];
}

export function CatalogHero({ countLabel, title, subtitle, description, stats }: CatalogHeroProps) {
  return (
    <section className="pt-32 pb-16">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="mb-6 inline-flex items-center gap-2 border border-border bg-surface-raised px-4 py-1.5">
          <span className="font-medium text-muted text-w-sm">{countLabel}</span>
        </div>

        <div className="grid gap-8 md:grid-cols-12 md:items-end">
          <div className="md:col-span-7">
            <h1 className="font-semibold text-foreground text-w-xl leading-tight md:text-w-2xl">
              {title}
              <br />
              <span className="text-muted">{subtitle}</span>
            </h1>
            <p className="mt-6 max-w-2xl text-muted text-w-lg leading-relaxed">{description}</p>
          </div>

          <div className="md:col-span-5">
            <div className="grid gap-px border border-border bg-border sm:grid-cols-2">
              {stats.map((stat) => (
                <div key={stat.label} className="bg-background p-4">
                  <div className="mono-label text-muted">{stat.label}</div>
                  <div className="mt-2 text-foreground text-w-sm">{stat.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
