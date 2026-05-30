export interface AppReview {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  reviewer: string;
  createdAt: string;
  territory: string;
}

export interface AppReviewSummary {
  text: string;
  territory: string;
  platform: string;
  createdAt: string;
}

export interface AppStoreOverview {
  appName: string;
  bundleId: string;
  averageRating: number;
  totalReviews: number;
  recentReviews: AppReview[];
  reviewSummary: AppReviewSummary | null;
  latestVersion: string | null;
  latestVersionState: string | null;
  latestVersionCreatedAt: string | null;
  recentNegativeReviews: number;
  recentPositiveReviews: number;
  releaseRisk: "low" | "elevated" | "high";
}
