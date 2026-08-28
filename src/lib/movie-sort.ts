/**
 * Returns a normalized title for sorting purposes, stripping leading English articles
 * ("The ", "A ", "An ") case-insensitively.
 *
 * Example:
 *   "The Elephant Man" -> "Elephant Man"
 *   "A Clockwork Orange" -> "Clockwork Orange"
 *   "An American Werewolf in London" -> "American Werewolf in London"
 *   "The Hudsucker Proxy" -> "Hudsucker Proxy"
 */
export function getSortableTitle(title: string): string {
  if (!title) return "";
  // Strip leading "the ", "a ", "an " (case-insensitive)
  return title.replace(/^(?:the|a|an)\s+/i, "").trim();
}

/**
 * Comparator function to sort movie objects by sortable title,
 * falling back to the original title if identical.
 */
export function compareMovieTitles<T extends { title: string }>(a: T, b: T): number {
  const sortA = getSortableTitle(a.title);
  const sortB = getSortableTitle(b.title);
  const cmp = sortA.localeCompare(sortB, undefined, { sensitivity: "base" });
  if (cmp !== 0) return cmp;
  return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
}

/**
 * Sorts an array of movie objects by title (ignoring leading articles) immutably.
 */
export function sortMoviesByTitle<T extends { title: string }>(movies: T[]): T[] {
  return [...movies].sort(compareMovieTitles);
}
