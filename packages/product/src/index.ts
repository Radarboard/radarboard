export const PRODUCT_NAME = "Radarboard";
export const PRODUCT_DESCRIPTION = "Real-time business dashboard";
export const PRODUCT_DASHBOARD_DESCRIPTION =
  "Real-time business dashboard for revenue, analytics, and project health";
export const PRODUCT_WAITLIST_SUBJECT = `You're on the ${PRODUCT_NAME} waitlist!`;

export function formatProductTitle(title: string): string {
  return `${title} — ${PRODUCT_NAME}`;
}
