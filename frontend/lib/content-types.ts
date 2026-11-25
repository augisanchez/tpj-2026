/**
 * The one place content types are named. Every label, chip, filter,
 * count and sentence on the site reads from here.
 *
 *   essay      Photo Essay   photo essay / photo essays
 *   interview  Interview     interview / interviews
 *   feature    Feature       feature / features
 *
 * "Story" is the umbrella for any of the three, used only when a count
 * or list mixes types ("12 stories"). Never "essay" alone, "article",
 * "piece" or "photo story".
 */
export type ContentType = "essay" | "interview" | "feature";

export const CONTENT_TYPES: Record<ContentType, { label: string; plural: string; one: string; many: string }> = {
  essay: { label: "Photo Essay", plural: "Photo Essays", one: "photo essay", many: "photo essays" },
  interview: { label: "Interview", plural: "Interviews", one: "interview", many: "interviews" },
  feature: { label: "Feature", plural: "Features", one: "feature", many: "features" },
};

/** Title-case label for chips and badges: "Photo Essay". */
export const typeLabel = (t: ContentType) => CONTENT_TYPES[t].label;

/** Title-case plural for filters and headings: "Photo Essays". */
export const typePlural = (t: ContentType) => CONTENT_TYPES[t].plural;

/** "1 photo essay", "3 interviews". */
export const countOf = (n: number, t: ContentType) => `${n} ${n === 1 ? CONTENT_TYPES[t].one : CONTENT_TYPES[t].many}`;

/** Mixed-type count: "1 story", "12 stories". */
export const countStories = (n: number) => `${n} ${n === 1 ? "story" : "stories"}`;

/** "3 photo essays · 1 interview": one segment per type present, canonical order. */
export function countByType(items: { contentType: ContentType }[], sep = "  ·  "): string {
  const order: ContentType[] = ["essay", "interview", "feature"];
  return order
    .map((t) => [t, items.filter((i) => i.contentType === t).length] as const)
    .filter(([, n]) => n > 0)
    .map(([t, n]) => countOf(n, t))
    .join(sep);
}

export const TYPE_LABELS: Record<ContentType, string> = {
  essay: CONTENT_TYPES.essay.label,
  interview: CONTENT_TYPES.interview.label,
  feature: CONTENT_TYPES.feature.label,
};

export const TYPE_PLURALS: Record<ContentType, string> = {
  essay: CONTENT_TYPES.essay.plural,
  interview: CONTENT_TYPES.interview.plural,
  feature: CONTENT_TYPES.feature.plural,
};
