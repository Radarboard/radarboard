// ---------------------------------------------------------------------------
// Cross-plugin intent system — payload types and result contract
// ---------------------------------------------------------------------------

/** Discriminator for the three payload shapes plugins can send/receive. */
export type IntentPayloadKind = "text" | "link" | "structured";

/** Fields shared by every intent payload. */
interface IntentPayloadBase {
  /** Plugin ID of the sender (auto-injected by PluginHost). */
  sourcePluginId: string;
  /** Optional project context for the item. */
  projectSlug?: string | null;
  /** Arbitrary metadata from the source (e.g. original item ID for back-references). */
  sourceMeta?: Record<string, unknown>;
}

/** Plain text payload — title + optional body. */
export interface TextIntentPayload extends IntentPayloadBase {
  kind: "text";
  title: string;
  body?: string;
  tags?: string[];
}

/** Link payload — URL with title/description. */
export interface LinkIntentPayload extends IntentPayloadBase {
  kind: "link";
  url: string;
  title: string;
  description?: string;
  tags?: string[];
}

/** Rich structured payload — carries the full source item for advanced handling. */
export interface StructuredIntentPayload extends IntentPayloadBase {
  kind: "structured";
  /** Source item type, e.g. "changelog-entry", "rss-item", "task". */
  itemType: string;
  title: string;
  bodyMarkdown?: string;
  data: Record<string, unknown>;
  tags?: string[];
}

/** Discriminated union of all cross-plugin payload shapes. */
export type IntentPayload = TextIntentPayload | LinkIntentPayload | StructuredIntentPayload;

/**
 * Payload input type for callers — same as IntentPayload but without
 * `sourcePluginId` (which is auto-injected by the PluginHost).
 * We distribute `Omit` across the union to preserve the discriminator.
 */
export type IntentPayloadInput =
  | Omit<TextIntentPayload, "sourcePluginId">
  | Omit<LinkIntentPayload, "sourcePluginId">
  | Omit<StructuredIntentPayload, "sourcePluginId">;

/** Result returned by an intent handler after processing a payload. */
export interface IntentResult {
  success: boolean;
  /** Optional message shown to the user via toast. */
  message?: string;
  /** If the handler created an item, its ID (for deep-linking). */
  createdItemId?: string;
}
