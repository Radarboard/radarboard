import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { privacySections } from "@/data/legal";
import { site } from "@/data/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${site.name} handles information across the website, beta signup, desktop app, and connected services.`,
};

/* biome-ignore lint/style/noDefaultExport: Next.js app routes require a default export. */
export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow={`${site.name} / privacy`}
      title="Privacy Policy"
      description={`This policy explains what ${site.name} collects, how it is used, and what choices you have when using the website, beta program, desktop app, and connected integrations.`}
      sections={privacySections}
    />
  );
}
