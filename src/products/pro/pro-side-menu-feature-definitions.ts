import { communitySideMenuFeatureDefinitions } from "../community/community-side-menu-feature-definitions";

const proAdditionalSideMenuFeatureDefinitions = [] as const;

export const proSideMenuFeatureDefinitions = [
  ...communitySideMenuFeatureDefinitions,
  ...proAdditionalSideMenuFeatureDefinitions,
] as const;
