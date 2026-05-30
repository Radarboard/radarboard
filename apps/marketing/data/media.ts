import { PRODUCT_NAME } from "@radarboard/product";

export interface MarketingMediaSlot {
  eyebrow: string;
  title: string;
  description?: string;
  aspect?: "video" | "square";
  imageSrc?: string;
  videoSrc?: string;
  imageAlt?: string;
}

function slot(config: MarketingMediaSlot): MarketingMediaSlot {
  return config;
}

export const marketingMedia = {
  hero: {
    ...slot({
      eyebrow: "Dashboard",
      title: "Radarboard product dashboard",
      description: "Captured from the real Radarboard app surface.",
      aspect: "video",
      imageSrc: "/media/radarboard-dashboard.png",
      imageAlt: `${PRODUCT_NAME} hero dashboard screenshot`,
    }),
  },
  demo: {
    ...slot({
      eyebrow: "Widget surfaces",
      title: "Radarboard widget library",
      description: "Captured from real Radarboard widget components.",
      aspect: "video",
      imageSrc: "/media/radarboard-widgets.png",
      imageAlt: `${PRODUCT_NAME} dashboard demo`,
    }),
  },
  workflows: {
    maintainer: slot({
      eyebrow: "Maintainer workflow",
      title: "Open-source operating view",
      description: "GitHub, sponsors, packages, releases, and project health in one board.",
      aspect: "video",
      imageSrc: "/media/radarboard-dashboard.png",
      imageAlt: `${PRODUCT_NAME} maintainer workflow screenshot`,
    }),
    creator: slot({
      eyebrow: "Creator workflow",
      title: "Audience and revenue view",
      description: "Traffic, sponsorship, publishing, and revenue signals in one board.",
      aspect: "video",
      imageSrc: "/media/radarboard-widgets.png",
      imageAlt: `${PRODUCT_NAME} creator workflow screenshot`,
    }),
    team: slot({
      eyebrow: "Team workflow",
      title: "Launch and operations view",
      description: "Deploys, incidents, roadmap, and revenue movement side by side.",
      aspect: "video",
      imageSrc: "/media/radarboard-dashboard.png",
      imageAlt: `${PRODUCT_NAME} team workflow screenshot`,
    }),
  },
  community: {
    boards: slot({
      eyebrow: "Future Surface",
      title: "Community boards",
      description: "Planned for a later release.",
      aspect: "video",
      imageAlt: `${PRODUCT_NAME} community boards preview`,
    }),
    templates: slot({
      eyebrow: "Future Surface",
      title: "Templates",
      description: "Planned for a later release.",
      aspect: "video",
      imageAlt: `${PRODUCT_NAME} templates preview`,
    }),
    showcases: slot({
      eyebrow: "Future Surface",
      title: "Showcases",
      description: "Planned for a later release.",
      aspect: "video",
      imageAlt: `${PRODUCT_NAME} showcases preview`,
    }),
  },
} as const;
