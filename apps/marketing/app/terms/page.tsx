import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { termsSections } from "@/data/legal";
import { site } from "@/data/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `Terms for using ${site.name}, including the website, beta program, downloads, desktop app, and connected services.`,
};

/* biome-ignore lint/style/noDefaultExport: Next.js app routes require a default export. */
export default function TermsPage() {
  return (
    <LegalPage
      eyebrow={`${site.name} / terms`}
      title="Terms of Service"
      description={`These terms explain the rules for using ${site.name}, including the website, beta access, downloads, desktop app, integrations, and related services.`}
      sections={termsSections}
    />
  );
}
