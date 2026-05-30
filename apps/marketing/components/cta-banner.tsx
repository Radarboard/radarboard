"use client";

import { site } from "@/data/site";
import { useWaitlistForm } from "@/hooks/use-waitlist-form";
import type { DesktopReleaseAction } from "@/lib/desktop-releases";

const defaultReleaseAction = {
  label: "Join macOS beta",
  href: site.links.beta,
  caption: "macOS beta access is opening now. Join the list for the first public Mac build.",
  external: false,
  release: null,
} satisfies DesktopReleaseAction;

export function CTABanner({
  releaseAction = defaultReleaseAction,
}: {
  releaseAction?: DesktopReleaseAction;
}) {
  const { email, setEmail, state, message, submit } = useWaitlistForm();
  const hasPublishedRelease = releaseAction.release !== null;

  return (
    <section id="waitlist" className="mx-auto max-w-7xl px-4 md:px-8">
      <div className="grid gap-8 border border-border bg-surface p-6 md:grid-cols-12 md:p-8">
        <div className="md:col-span-7">
          <p className="eyebrow text-muted">Beta access</p>
          <h2 className="mt-4 max-w-3xl font-semibold text-foreground text-w-xl leading-tight">
            {hasPublishedRelease
              ? "Download the macOS desktop build."
              : "Join the macOS beta before the hosted path exists."}
          </h2>
          <p className="mt-5 max-w-2xl text-muted text-w-base leading-relaxed">
            Radarboard starts as a macOS-first local app. Releases are read from published GitHub
            desktop tags, while the beta list stays open for install testing, Homebrew availability,
            and the hosted or custom path for teams that need shared access later.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a
              href={site.links.github}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center border border-accent bg-accent px-5 font-medium text-background text-w-sm transition-interactive hover:bg-accent-light"
            >
              View source
            </a>
            <a
              href={site.links.docs}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center border border-border bg-background px-5 font-medium text-foreground text-w-sm transition-interactive hover:border-accent hover:text-accent"
            >
              Read setup docs
            </a>
          </div>
        </div>

        <div className="md:col-span-5">
          <div className="border border-border bg-background p-2">
            {hasPublishedRelease ? (
              <div className="grid gap-2">
                <a
                  href={releaseAction.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center justify-center border border-accent bg-accent px-5 font-medium text-background text-w-sm transition-interactive hover:bg-accent-light"
                >
                  {releaseAction.label}
                </a>
                <a
                  href={site.links.releases}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center justify-center border border-border bg-surface px-5 font-medium text-foreground text-w-sm transition-interactive hover:border-accent hover:text-accent"
                >
                  View release notes
                </a>
              </div>
            ) : state === "success" ? (
              <div className="flex min-h-12 items-center gap-3 px-3 text-success text-w-sm">
                <span className="h-2 w-2 shrink-0 bg-success" />
                <span>{message}</span>
              </div>
            ) : (
              <>
                <form onSubmit={submit} className="flex flex-col gap-2">
                  <label className="sr-only" htmlFor="waitlist-email">
                    Email address
                  </label>
                  <input
                    id="waitlist-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    className="min-h-11 w-full border border-border bg-surface px-3 text-foreground text-w-sm outline-none transition-interactive placeholder:text-muted-foreground focus:border-accent"
                  />
                  <button
                    type="submit"
                    disabled={state === "loading"}
                    className="min-h-11 w-full border border-accent bg-accent px-5 font-medium text-background text-w-sm transition-interactive hover:bg-accent-light disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {state === "loading" ? "Submitting" : "Join beta list"}
                  </button>
                </form>
                {state === "error" && (
                  <p className="px-1 pt-2 text-destructive text-w-xs">{message}</p>
                )}
              </>
            )}
          </div>

          <p className="mt-3 text-muted text-w-xs">{releaseAction.caption}</p>
          <p className="mt-1 text-muted text-w-xs">{site.platform.availabilityNote}</p>
        </div>
      </div>
    </section>
  );
}
