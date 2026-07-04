/**
 * Generic REST — Data types
 *
 * The widget fetches arbitrary JSON from a configured integration + action and
 * maps fields onto template sections, so the source data is an open record.
 */

/** Arbitrary JSON returned by the configured integration endpoint. */
export type GenericRestData = Record<string, unknown>;

/** The subset of widget config this widget reads to decide what to fetch. */
export interface GenericRestBinding {
  /** Integration id to fetch from, e.g. a user-created REST integration. */
  integrationId?: string;
  /** Data-source action on that integration, e.g. "summary". Defaults to "data". */
  dataSourceAction?: string;
}
