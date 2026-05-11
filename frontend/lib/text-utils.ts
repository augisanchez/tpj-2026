/**
 * Title-cases a person's name. Lowercases the input first so all-caps
 * entries ("JANE DOE") normalize cleanly, then capitalizes the first
 * letter of each word — including parts after hyphens and apostrophes
 * so "jean-luc godard" → "Jean-Luc Godard" and "o'brien" → "O'Brien".
 *
 * Does NOT special-case Scottish/Irish prefixes (Mc/Mac) or European
 * particles (van, de, von), since heuristics there are fragile. If a
 * specific photographer's casing matters, fix it at the WP source.
 */
export function titleCaseName(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/(^|[\s\-'])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase());
}

/**
 * Slugify a name into a URL-safe segment. Strips accents (Elié → elie),
 * lowercases, and collapses non-alphanumerics to single hyphens. Used
 * to derive a stable slug for articles that have a `photographerName`
 * but no migrated Photographer CPT record yet, so they can still appear
 * on the index and route to a detail page.
 */
export function slugifyName(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Curated set of HTML named entities that show up in TPJ content.
 * `&amp;` is decoded separately (first) so doubly-encoded entities like
 * `&amp;#8217;` resolve to their final character in a single pass.
 */
const NAMED_HTML_ENTITIES: Record<string, string> = {
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  sbquo: "‚",
  bdquo: "„",
  prime: "′",
  Prime: "″",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  copy: "©",
  reg: "®",
  trade: "™",
  middot: "·",
  bull: "•",
  times: "×",
};

/**
 * Decode HTML entities (named, decimal numeric, hex numeric) into their
 * Unicode characters. Handles single-encoded text from WordPress as well
 * as the occasional doubly-encoded entity (`&amp;#8217;`) that survives
 * a copy-paste round-trip — we decode `&amp;` first so the inner numeric
 * form gets a second chance at the numeric pass.
 */
export function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/gi, "&")
    .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (m, name) => {
      const decoded = NAMED_HTML_ENTITIES[name];
      return decoded ?? NAMED_HTML_ENTITIES[name.toLowerCase()] ?? m;
    })
    .replace(/&#(\d+);/g, (m, n) => {
      const code = parseInt(n, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (m, h) => {
      const code = parseInt(h, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    });
}

/**
 * Strip HTML tags, decode entities, collapse whitespace to single spaces.
 * Use for previews, cards, and anywhere a paragraph should sit on one
 * line.
 */
export function htmlToInlineText(html: string | null | undefined): string {
  if (!html) return "";
  const stripped = html.replace(/<[^>]+>/g, " ");
  return decodeHtmlEntities(stripped).replace(/\s+/g, " ").trim();
}

/**
 * Strip HTML tags and decode entities, preserving paragraph breaks. Use
 * for full-bio rendering where the visual rhythm of paragraphs matters.
 */
export function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return "";
  const cleaned = html
    .replace(/<\/?(p|div)[^>]*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n");
  return decodeHtmlEntities(cleaned)
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
