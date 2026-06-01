import { site } from "@/data/site";

export type LegalSection = {
  id: string;
  title: string;
  paragraphs: readonly string[];
  items?: readonly string[];
};

export const legal = {
  lastUpdated: "June 1, 2026",
  contactEmail: "hello@radarboard.app",
  operator: site.company.name,
  governingLaw: "Ontario, Canada",
} as const;

export const privacySections = [
  {
    id: "scope",
    title: "Scope",
    paragraphs: [
      `This Privacy Policy explains how ${legal.operator} handles information for ${site.name}, including the public website, beta signup, documentation links, desktop downloads, and the Radarboard app experience.`,
      "Radarboard is designed as a local-first product. The app can run with a local SQLite database by default. Optional integrations, optional sync providers, hosted features, beta programs, and website services may involve third-party services as described below.",
    ],
  },
  {
    id: "information-we-collect",
    title: "Information We Collect",
    paragraphs: [
      "We collect only the information needed to operate the website, manage beta access, deliver the app, respond to requests, and improve the product.",
    ],
    items: [
      "Contact information, such as the email address you submit when joining the beta list or contacting us.",
      "Website and product interest information, such as pages visited, referring pages, approximate location, device type, browser, and session activity collected through privacy-conscious analytics.",
      "Download and release information, such as the GitHub release page or installer asset you choose to open.",
      "Support information you choose to send, such as messages, screenshots, logs, diagnostics, or other context you provide when asking for help.",
      "App configuration and integration information that you enter into Radarboard, such as service connection settings, API keys, OAuth credentials, webhook URLs, or local preferences.",
    ],
  },
  {
    id: "local-first-app-data",
    title: "Local-First App Data",
    paragraphs: [
      "Radarboard is built to keep day-to-day board data on your device when you use the default local desktop setup. The desktop app uses local SQLite by default and can store preferences, layouts, widget configuration, and integration credentials locally.",
      "If you choose optional cloud sync, hosted features, remote databases, third-party integrations, or MCP-connected workflows, information may be sent to the services you configure. Those services process information under their own terms and privacy policies.",
      "Radarboard may encrypt stored credentials before writing them to supported credential stores, but you remain responsible for choosing which services to connect and for protecting your device, accounts, tokens, and database configuration.",
    ],
  },
  {
    id: "how-we-use-information",
    title: "How We Use Information",
    paragraphs: [
      "We use information for the purposes described at collection and for normal operation of Radarboard.",
    ],
    items: [
      "Provide the website, app downloads, beta signup, documentation, support, and product communications.",
      "Send beta access updates, welcome emails, release information, and service messages.",
      "Understand website usage, improve page content, and evaluate demand for integrations and features.",
      "Operate, secure, debug, and improve Radarboard, including investigating errors, abuse, or reliability issues.",
      "Comply with legal obligations and enforce our Terms.",
    ],
  },
  {
    id: "third-party-services",
    title: "Third-Party Services",
    paragraphs: [
      "Radarboard uses third-party services where they are needed for the website, beta program, downloads, analytics, communications, and user-configured integrations.",
    ],
    items: [
      "OpenPanel may process website analytics events when analytics is enabled on the marketing site.",
      "Resend processes beta signup contacts and welcome emails submitted through the waitlist form.",
      "GitHub hosts Radarboard source code, releases, release notes, and downloadable desktop assets.",
      "Integration providers process the data you authorize Radarboard to access, such as GitHub, Sentry, OpenPanel, RevenueCat, Resend, Google Search Console, App Store Connect, and similar services.",
      "Infrastructure, hosting, email, security, and support providers may process limited information needed to deliver their services.",
    ],
  },
  {
    id: "cookies-and-tracking",
    title: "Cookies And Tracking",
    paragraphs: [
      "The marketing site may use cookies, local storage, pixels, or similar technologies for analytics, security, session continuity, and basic site operation. We do not use these technologies to sell personal information.",
      "Browser and device controls may let you block or delete cookies and limit analytics collection. Some site features may not work correctly if required browser storage is disabled.",
    ],
  },
  {
    id: "sharing",
    title: "How We Share Information",
    paragraphs: [
      "We do not sell personal information. We share information only when needed to operate Radarboard, use service providers, honor your instructions, protect rights and security, complete a business transaction, or comply with law.",
      "When you connect a third-party service inside Radarboard, information may move between your device, Radarboard, and that service based on the permissions and credentials you provide.",
    ],
  },
  {
    id: "retention",
    title: "Retention",
    paragraphs: [
      "We keep information only as long as reasonably needed for the purpose collected, including beta communications, support, security, legal compliance, and product operations.",
      "Local app data remains on your device or in the storage provider you configure until you delete it, uninstall the app, reset the database, revoke credentials, or remove the connected service data. Third-party providers may retain information under their own policies.",
    ],
  },
  {
    id: "security",
    title: "Security",
    paragraphs: [
      "We use reasonable administrative, technical, and organizational safeguards appropriate for the nature of the information we handle. No online or local system can be guaranteed to be perfectly secure.",
      "You are responsible for protecting your device, accounts, secrets, API keys, OAuth credentials, database URLs, and any services you connect to Radarboard.",
    ],
  },
  {
    id: "your-rights",
    title: "Your Rights And Choices",
    paragraphs: [
      "Depending on where you live, you may have rights to access, correct, delete, export, restrict, or object to certain processing of your personal information. You may also have the right to withdraw consent or complain to a data protection authority.",
      `To make a request, contact ${legal.contactEmail}. We may need to verify your request before acting on it. Some requests may be limited by legal, security, fraud-prevention, or operational requirements.`,
    ],
  },
  {
    id: "children",
    title: "Children",
    paragraphs: [
      "Radarboard is not directed to children under 13, and we do not knowingly collect personal information from children under 13. If you believe a child provided personal information to us, contact us so we can take appropriate action.",
    ],
  },
  {
    id: "international-transfers",
    title: "International Transfers",
    paragraphs: [
      `${legal.operator} is based in Canada, and our providers or users may be located in other countries. Information may be processed in Canada, the United States, the European Economic Area, and other locations where we or our providers operate.`,
      "Where required, we rely on appropriate legal mechanisms for cross-border processing and transfers.",
    ],
  },
  {
    id: "changes",
    title: "Changes To This Policy",
    paragraphs: [
      "We may update this Privacy Policy as Radarboard changes. When we make material changes, we will update the date above and, when appropriate, provide additional notice through the website, app, email, or release notes.",
    ],
  },
] as const satisfies readonly LegalSection[];

export const termsSections = [
  {
    id: "agreement",
    title: "Agreement",
    paragraphs: [
      `These Terms govern your access to and use of ${site.name}, including the website, documentation, beta signup, downloads, desktop app, app-related services, and related communications provided by ${legal.operator}.`,
      "By using Radarboard, downloading the app, joining the beta, or accessing the website, you agree to these Terms. If you do not agree, do not use Radarboard.",
    ],
  },
  {
    id: "eligibility",
    title: "Eligibility And Accounts",
    paragraphs: [
      "You must be able to form a binding agreement to use Radarboard. If you use Radarboard for an organization, you represent that you have authority to bind that organization to these Terms.",
      "Some features may require accounts, credentials, API keys, OAuth grants, or third-party service access. You are responsible for the accounts, permissions, and credentials you configure.",
    ],
  },
  {
    id: "beta",
    title: "Beta And Pre-Release Features",
    paragraphs: [
      "Radarboard may offer beta, preview, experimental, or pre-release features. These features may be incomplete, change without notice, contain bugs, lose data, or be discontinued.",
      "Do not rely on beta features for critical operations unless you have tested them for your own needs and maintain appropriate backups, exports, and fallback processes.",
    ],
  },
  {
    id: "downloads",
    title: "Downloads And Updates",
    paragraphs: [
      "Radarboard desktop releases may be distributed through GitHub releases, installer assets, Homebrew or similar package channels, or other download paths we provide.",
      "You are responsible for downloading Radarboard from trusted sources, keeping your device secure, and deciding when to install updates. Release availability, signing, notarization, and update behavior may vary by platform and release channel.",
    ],
  },
  {
    id: "license",
    title: "License And Ownership",
    paragraphs: [
      "Subject to these Terms, we grant you a limited, revocable, non-exclusive, non-transferable license to use Radarboard for your personal or internal business purposes.",
      "Radarboard, the website, product design, branding, and related materials are owned by us or our licensors. Open-source components and repository code may be governed by their own licenses, and those licenses control where they apply.",
    ],
  },
  {
    id: "your-data",
    title: "Your Data And Responsibilities",
    paragraphs: [
      "You retain responsibility for the data, credentials, configurations, prompts, outputs, files, service connections, and content you place in or connect to Radarboard.",
      "You must have the rights and permissions needed to connect services, access data, create automations, send notifications, or use any third-party information with Radarboard.",
      "You are responsible for backing up important local data and for understanding how your configured database, sync provider, or third-party services store and retain information.",
    ],
  },
  {
    id: "acceptable-use",
    title: "Acceptable Use",
    paragraphs: [
      "You may not misuse Radarboard or use it to harm others, disrupt services, or violate law.",
    ],
    items: [
      "Do not attempt unauthorized access to Radarboard, our systems, or third-party services.",
      "Do not interfere with, overload, probe, scan, or attack any service, network, or account.",
      "Do not use Radarboard to violate privacy, intellectual property, export, anti-spam, security, or other applicable laws.",
      "Do not upload, transmit, or generate unlawful, harmful, deceptive, abusive, or infringing content.",
      "Do not remove notices, bypass technical limits, or use Radarboard in a way that could compromise product security or integrity.",
    ],
  },
  {
    id: "third-party-services",
    title: "Third-Party Services And Integrations",
    paragraphs: [
      "Radarboard is designed to connect to services you already use. Third-party services are not controlled by us and may change, suspend access, rate-limit requests, revoke credentials, or process data under their own terms and privacy policies.",
      "We are not responsible for third-party services, third-party content, API availability, account decisions, billing, outages, or data handling outside our control.",
    ],
  },
  {
    id: "payments",
    title: "Plans, Payments, And Availability",
    paragraphs: [
      "Some Radarboard features may be free, beta-only, paid, usage-limited, or offered under custom terms. Pricing, packaging, availability, platform support, and feature access may change over time.",
      "If paid features are offered, additional payment, subscription, cancellation, refund, tax, or procurement terms may apply at checkout or in a separate agreement.",
    ],
  },
  {
    id: "feedback",
    title: "Feedback",
    paragraphs: [
      "If you send ideas, suggestions, bug reports, or other feedback, you grant us permission to use that feedback without restriction or compensation. You should not send confidential information unless we have agreed in writing to receive it confidentially.",
    ],
  },
  {
    id: "disclaimers",
    title: "Disclaimers",
    paragraphs: [
      "Radarboard is provided on an as-is and as-available basis. To the maximum extent permitted by law, we disclaim warranties of merchantability, fitness for a particular purpose, title, non-infringement, availability, accuracy, and error-free operation.",
      "Radarboard helps surface signals from connected tools, but it is not a substitute for your own monitoring, security, financial, legal, operational, incident response, or business judgment.",
    ],
  },
  {
    id: "liability",
    title: "Limitation Of Liability",
    paragraphs: [
      "To the maximum extent permitted by law, we will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost profits, revenue, goodwill, data, or business opportunities.",
      "To the maximum extent permitted by law, our total liability for any claim relating to Radarboard or these Terms will not exceed the greater of the amount you paid us for Radarboard in the three months before the claim or CAD $100.",
    ],
  },
  {
    id: "termination",
    title: "Suspension And Termination",
    paragraphs: [
      "You may stop using Radarboard at any time. We may suspend or terminate access to website, beta, hosted, support, or download services if we believe you violated these Terms, created risk, or if we discontinue a service.",
      "Sections that by their nature should survive termination will survive, including ownership, disclaimers, liability limits, governing law, and payment obligations.",
    ],
  },
  {
    id: "changes",
    title: "Changes To These Terms",
    paragraphs: [
      "We may update these Terms as Radarboard changes. When we make material changes, we will update the date above and, when appropriate, provide additional notice through the website, app, email, or release notes.",
      "Continuing to use Radarboard after updated Terms become effective means you accept the updated Terms.",
    ],
  },
  {
    id: "governing-law",
    title: "Governing Law",
    paragraphs: [
      `These Terms are governed by the laws of ${legal.governingLaw}, without regard to conflict-of-law rules. Courts located in Ontario, Canada will have exclusive jurisdiction for disputes that are not required to be handled elsewhere by applicable law.`,
    ],
  },
] as const satisfies readonly LegalSection[];
