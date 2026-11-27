/**
 * The quick-search index: every story, artist and theme in a compact
 * shape, served once from /api/search-index and matched in the browser
 * on every keystroke. Full-text search (words inside a story) stays on
 * /search, which asks WordPress.
 */

export type IndexStory = {
  /** Title, decoded. */
  t: string;
  /** Path, e.g. /essay/sunny-up. */
  h: string;
  /** Photographer credit. */
  p: string | null;
  /** Content type. */
  k: "essay" | "interview" | "feature";
  /** Year published. */
  y: number | null;
  /** Small cover thumbnail URL. */
  i: string | null;
  /** Theme names. */
  th: string[];
};

export type IndexArtist = {
  n: string;
  h: string;
  /** Stories they're credited on. */
  c: number;
  i: string | null;
};

export type IndexTheme = { n: string; h: string; p: string };

export type SearchIndex = {
  stories: IndexStory[];
  artists: IndexArtist[];
  themes: IndexTheme[];
};

/** Lowercase, accents folded: "Ólafur" matches "olafur". */
export function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

type Prepared<T> = T & { _hay: string; _head: string };

export type PreparedIndex = {
  stories: Prepared<IndexStory>[];
  artists: Prepared<IndexArtist>[];
  themes: Prepared<IndexTheme>[];
};

const TYPE_WORD: Record<IndexStory["k"], string> = {
  essay: "essay photo essay",
  interview: "interview",
  feature: "feature",
};

/** Folds every searchable field once, so typing only does string checks. */
export function prepareIndex(raw: SearchIndex): PreparedIndex {
  return {
    stories: raw.stories.map((s) => ({
      ...s,
      _head: fold(s.t),
      _hay: fold([s.t, s.p ?? "", s.th.join(" "), TYPE_WORD[s.k], s.y ?? ""].join(" ")),
    })),
    artists: raw.artists.map((a) => ({ ...a, _head: fold(a.n), _hay: fold(a.n) })),
    themes: raw.themes.map((t) => ({ ...t, _head: fold(t.n), _hay: fold(`${t.n} ${t.p}`) })),
  };
}

/** Higher is better: the whole query at the start, then a word starting
 *  with it, then anywhere. 0 means "not every word matched". */
function score(head: string, hay: string, q: string, tokens: string[]): number {
  if (!tokens.every((t) => hay.includes(t))) return 0;
  if (head.startsWith(q)) return 100;
  if (head.includes(` ${q}`)) return 80;
  if (head.includes(q)) return 60;
  if (tokens.every((t) => head.includes(t))) return 40;
  return 20;
}

export type QuickResults = {
  artists: IndexArtist[];
  stories: IndexStory[];
  themes: IndexTheme[];
};

export function quickSearch(
  index: PreparedIndex,
  query: string,
  limits = { artists: 4, stories: 8, themes: 3 },
): QuickResults {
  const q = fold(query.trim()).replace(/\s+/g, " ");
  if (!q) return { artists: [], stories: [], themes: [] };
  const tokens = q.split(" ");
  const rank = <T extends { _head: string; _hay: string }>(
    items: T[],
    tie: (a: T, b: T) => number,
    limit: number,
  ) =>
    items
      .map((it) => ({ it, s: score(it._head, it._hay, q, tokens) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || tie(a.it, b.it))
      .slice(0, limit)
      .map((x) => x.it);
  return {
    // Artists with more stories first; newer stories first.
    artists: rank(index.artists, (a, b) => b.c - a.c, limits.artists),
    stories: rank(index.stories, (a, b) => (b.y ?? 0) - (a.y ?? 0), limits.stories),
    themes: rank(index.themes, () => 0, limits.themes),
  };
}

/** Splits text around the first match of the query's first word, for a
 *  highlight. Skipped when folding changed the length (accents), since
 *  the positions would no longer line up. */
export function highlight(text: string, query: string): [string, string, string] | null {
  const word = fold(query.trim()).split(/\s+/)[0];
  if (!word) return null;
  const folded = fold(text);
  if (folded.length !== text.length) return null;
  const at = folded.startsWith(word) ? 0 : folded.indexOf(` ${word}`) + 1 || folded.indexOf(word);
  if (at < 0 || folded.slice(at, at + word.length) !== word) return null;
  return [text.slice(0, at), text.slice(at, at + word.length), text.slice(at + word.length)];
}
