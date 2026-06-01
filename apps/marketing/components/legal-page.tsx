import { type LegalSection, legal } from "@/data/legal";
import { site } from "@/data/site";

export function LegalPage({
  eyebrow,
  title,
  description,
  sections,
}: {
  eyebrow: string;
  title: string;
  description: string;
  sections: readonly LegalSection[];
}) {
  return (
    <article className="mx-auto max-w-7xl px-4 pt-28 pb-8 md:px-8 md:pt-32">
      <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
        <header className="min-w-0 lg:col-span-7">
          <p className="eyebrow text-accent">{eyebrow}</p>
          <h1 className="mt-5 font-semibold text-foreground text-w-xl leading-tight md:text-w-2xl">
            {title}
          </h1>
          <p className="mt-5 max-w-3xl text-muted text-w-base leading-relaxed">{description}</p>
          <p className="mt-5 text-muted text-w-xs">
            Last updated:{" "}
            <time dateTime="2026-06-01" className="text-foreground">
              {legal.lastUpdated}
            </time>
          </p>
        </header>

        <aside className="min-w-0 border border-border bg-surface p-5 lg:col-span-4 lg:col-start-9">
          <p className="mono-label text-accent-light">Legal contact</p>
          <dl className="mt-4 space-y-4">
            <div>
              <dt className="text-muted text-w-xs">Operator</dt>
              <dd className="mt-1 text-foreground text-w-sm">{legal.operator}</dd>
            </div>
            <div>
              <dt className="text-muted text-w-xs">Product</dt>
              <dd className="mt-1 text-foreground text-w-sm">{site.name}</dd>
            </div>
            <div>
              <dt className="text-muted text-w-xs">Email</dt>
              <dd className="mt-1">
                <a
                  href={`mailto:${legal.contactEmail}`}
                  className="break-words text-foreground text-w-sm transition-interactive hover:text-accent"
                >
                  {legal.contactEmail}
                </a>
              </dd>
            </div>
          </dl>
        </aside>
      </div>

      <div className="mt-14 grid gap-10 lg:grid-cols-12">
        <nav
          aria-label={`${title} sections`}
          className="min-w-0 border-border border-t pt-5 lg:col-span-3"
        >
          <p className="mono-label text-muted">Sections</p>
          <ol className="mt-4 space-y-3">
            {sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="block text-foreground text-w-sm transition-interactive hover:text-accent"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="min-w-0 space-y-10 lg:col-span-8 lg:col-start-5">
          {sections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="scroll-mt-24 border-border border-t pt-7"
            >
              <h2 className="font-semibold text-foreground text-w-lg">{section.title}</h2>
              <div className="mt-4 space-y-4">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph} className="text-muted text-w-sm leading-relaxed">
                    {paragraph}
                  </p>
                ))}
                {section.items ? (
                  <ul className="space-y-3">
                    {section.items.map((item) => (
                      <li key={item} className="flex gap-3 text-muted text-w-sm leading-relaxed">
                        <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 bg-accent" />
                        <span className="min-w-0">{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}
