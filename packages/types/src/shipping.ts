export type ShippingSource = "github" | "linear" | "vercel" | "manual";

export interface ShippingItem {
  id: string;
  title: string;
  projectName: string;
  projectColor: string;
  source: ShippingSource;
  url?: string;
  createdAt: string;
  timeAgo: string;
}
