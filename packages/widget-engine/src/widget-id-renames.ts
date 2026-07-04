/**
 * Cumulative map of every historical widget ID rename.
 *
 * When you rename a widget, add the OLD id as key → NEW id as value.
 * The client-side migration walks stored layouts/configs and replaces
 * any key it finds in this map with the current value.
 *
 * Because the map is cumulative, a user who hasn't opened the app since
 * the *first* rename will still migrate correctly in a single pass.
 */
// Only renames whose TARGET is a currently-registered widget belong here.
// Widgets that were removed entirely (e.g. the old provider widgets
// deployments/builds/projects/pulls/npm-downloads/github-stars/app-reviews/…)
// are intentionally NOT remapped: any stored layout still referencing them
// falls through to an empty, fillable slot instead of migrating onto another
// non-existent id.
export const WIDGET_ID_RENAMES: Record<string, string> = {
  raindrop: "bookmarks",
  detail: "observability",
  ideas: "roadmap",
};
