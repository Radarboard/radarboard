import { PRODUCT_NAME } from "@radarboard/product";
import pkg from "@/package.json";

export const site = {
  name: PRODUCT_NAME,
  tagline: "A desktop board for code, ops, and growth signals.",
  description:
    "Radarboard is a local-first desktop app for the revenue, release activity, growth, reliability, and open-source signals behind your work.",
  audiencesLabel:
    "founders, indie operators, open-source maintainers, developers, DevOps, marketers, creators, and teams",
  hero: {
    line1: "A desktop board",
    line2: "for the work you run.",
    description: "See the signals that matter before you open every source app.",
  },
  platform: {
    betaLabel: "macOS beta",
    availabilityNote: "Windows and Linux planned after the Mac beta.",
  },
  version: pkg.version,
  company: {
    name: "David Dias Digital",
    url: "https://daviddias.digital",
  },
  links: {
    docs: "https://docs.radarboard.app",
    x: "https://x.com/thedaviddias",
    github: "https://github.com/Radarboard/radarboard",
    releases: "https://github.com/Radarboard/radarboard/releases",
    beta: "/#waitlist",
    founder: "https://daviddias.digital",
  },
  stats: {
    waitlist: "0",
    integrations: "21+",
    widgets: "20+",
  },
} as const;
