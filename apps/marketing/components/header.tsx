"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { site } from "@/data/site";

const navLinks = [
  { href: "/integrations", label: "Integrations", external: false },
  { href: "/widgets", label: "Widgets", external: false },
  { href: site.links.docs, label: "Docs", external: true },
] as const;

function NavLink({
  href,
  label,
  external,
  active,
  onClick,
  className,
}: {
  href: string;
  label: string;
  external: boolean;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        onClick={onClick}
      >
        {label}
      </a>
    );
  }

  return (
    <Link
      href={href}
      className={className}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
    >
      {label}
    </Link>
  );
}

export function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const closeMenu = () => setMenuOpen(false);
    window.addEventListener("resize", closeMenu);
    return () => window.removeEventListener("resize", closeMenu);
  }, [menuOpen]);

  return (
    <header
      className={`fixed top-0 right-0 left-0 z-50 border-b bg-background/90 backdrop-blur-xl transition-interactive ${
        scrolled ? "border-border" : "border-transparent"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
        <Link
          href="/"
          className="font-semibold text-foreground text-w-base transition-interactive hover:text-accent"
          onClick={() => setMenuOpen(false)}
        >
          {site.name}
        </Link>

        <div className="flex items-center gap-3 md:gap-7">
          <ul className="hidden items-center gap-6 md:flex">
            {navLinks.map((link) => (
              <li key={link.href}>
                <NavLink
                  {...link}
                  active={!link.external && pathname === link.href}
                  className={[
                    "text-w-sm transition-interactive hover:text-foreground",
                    !link.external && pathname === link.href ? "text-foreground" : "text-muted",
                  ].join(" ")}
                />
              </li>
            ))}
          </ul>

          <Link
            href={site.links.beta}
            className="hidden min-h-10 items-center border border-accent bg-accent px-4 font-medium text-background text-w-sm transition-interactive hover:bg-accent-light sm:inline-flex"
          >
            {site.platform.betaLabel}
          </Link>

          <button
            type="button"
            aria-controls="marketing-mobile-menu"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            className="flex size-10 items-center justify-center border border-border bg-surface text-foreground transition-interactive hover:border-accent hover:text-accent md:hidden"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <svg
              aria-hidden="true"
              className="icon-base"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {menuOpen ? (
        <div
          id="marketing-mobile-menu"
          className="border-border border-t bg-background p-4 md:hidden"
        >
          <ul className="flex flex-col gap-2">
            {navLinks.map((link) => (
              <li key={link.href}>
                <NavLink
                  {...link}
                  active={!link.external && pathname === link.href}
                  className={[
                    "block border bg-surface px-4 py-3 text-w-sm transition-interactive hover:border-accent hover:text-accent",
                    !link.external && pathname === link.href
                      ? "border-accent text-accent"
                      : "border-border text-foreground",
                  ].join(" ")}
                  onClick={() => setMenuOpen(false)}
                />
              </li>
            ))}
          </ul>

          <Link
            href={site.links.beta}
            className="mt-3 flex min-h-11 items-center justify-center border border-accent bg-accent px-4 font-medium text-background text-w-sm transition-interactive hover:bg-accent-light"
            onClick={() => setMenuOpen(false)}
          >
            {site.platform.betaLabel}
          </Link>
        </div>
      ) : null}
    </header>
  );
}
