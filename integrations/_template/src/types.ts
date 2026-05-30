/**
 * __INTEGRATION_NAME__ — Data types
 */

/** Credentials stored for this integration. */
export interface __INTEGRATION_PASCAL__Config {
  /** API key obtained from the __INTEGRATION_NAME__ dashboard. */
  apiKey: string;
}

/** Data shape returned by the main data source. */
export interface __INTEGRATION_PASCAL__Data {
  /** List of items fetched from the API. */
  items: __INTEGRATION_PASCAL__Item[];
  /** Total count of items available. */
  totalCount: number;
  /** ISO 8601 timestamp of the last sync. */
  fetchedAt: string;
}

/** A single item from the __INTEGRATION_NAME__ API. */
export interface __INTEGRATION_PASCAL__Item {
  id: string;
  name: string;
  status: "active" | "inactive";
  createdAt: string;
}
