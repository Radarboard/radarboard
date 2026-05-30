import type { ProfileDefinition } from "../profile-config";
import { backendProfile } from "./backend";
import { contentCreatorProfile } from "./content-creator";
import { dataProfile } from "./data";
import { devopsProfile } from "./devops";
import { frontendProfile } from "./frontend";
import { fullstackProfile } from "./fullstack";
import { indieProfile } from "./indie";
import { marketingProfile } from "./marketing";
import { mobileProfile } from "./mobile";
import { opensourceProfile } from "./opensource";
import { seoProfile } from "./seo";
import { teamLeadProfile } from "./team-lead";

export const DEVELOPMENT_PROFILES: ProfileDefinition[] = [
  fullstackProfile,
  frontendProfile,
  backendProfile,
  mobileProfile,
  devopsProfile,
];

export const PRODUCT_PROFILES: ProfileDefinition[] = [
  indieProfile,
  teamLeadProfile,
  opensourceProfile,
];

export const GROWTH_PROFILES: ProfileDefinition[] = [
  seoProfile,
  marketingProfile,
  contentCreatorProfile,
  dataProfile,
];
