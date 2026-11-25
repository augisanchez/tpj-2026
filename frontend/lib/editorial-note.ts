/**
 * The editing note above a story's intro ("This interview has been
 * edited for length and clarity.").
 *
 * The note itself comes from the WordPress field (tpj_editorial_note).
 * Older interviews carried it as the last sentence of their intro text,
 * often after a hand-typed separator line ("----", "—", "⁂"); this strips
 * that copy (and the separator) from the intro if one is still there.
 * Sign-offs ("— Agustin") stay with the intro.
 */

export const EDITORIAL_NOTE_DEFAULT = "This interview has been edited for length and clarity.";

/** "This interview has been edited for clarity and content." and kin. */
const NOTE_LINE = /^(?:this|these)\s+interviews?\s+(?:has|have)\s+been\s+(?:edited|condensed)\b.*$/i;

/** A line that is only separator marks: dashes, rules, asterisms. */
const SEPARATOR_LINE = /^[\s\-‐‑‒–—―_*⁂※~·•]+$/;

export function splitEditorialNote(intro: string | null | undefined): {
  intro: string | null;
  note: string | null;
} {
  if (!intro) return { intro: intro ?? null, note: null };
  const lines = intro.replace(/\r\n?/g, "\n").split("\n");
  // Last line with text.
  let end = lines.length - 1;
  while (end >= 0 && !lines[end].trim()) end--;
  if (end < 0 || !NOTE_LINE.test(lines[end].trim())) {
    return { intro, note: null };
  }
  // Drop the note, then any blank or separator lines above it.
  let cut = end;
  while (cut > 0 && (!lines[cut - 1].trim() || SEPARATOR_LINE.test(lines[cut - 1]))) cut--;
  const rest = lines.slice(0, cut).join("\n").trim();
  return { intro: rest || null, note: EDITORIAL_NOTE_DEFAULT };
}
