/**
 * App Store Connect — Data types
 *
 * Config and API response types for the App Store Connect REST API v1.
 */

export interface ASCConfig {
  keyId: string;
  issuerId: string;
  privateKey: string;
}

export interface AppInfo {
  id: string;
  attributes: {
    name: string;
    bundleId: string;
    sku: string;
    primaryLocale: string;
    contentRightsDeclaration: string | null;
  };
}

export interface CustomerReview {
  id: string;
  attributes: {
    rating: number;
    title: string | null;
    body: string | null;
    reviewerNickname: string;
    createdDate: string;
    territory: string;
  };
}

export interface CustomerReviewSummarization {
  id: string;
  attributes: {
    text: string;
    territory: string;
    platform: string;
    createdDate: string;
  };
}

export interface AppStoreVersion {
  id: string;
  attributes: {
    versionString: string;
    appStoreState: string;
    platform: string;
    createdDate: string;
    releaseType: string;
  };
}
