/**
 * The editing note under a story's intro ("This interview has been
 * edited for length and clarity.").
 *
 * Interviews carried it as the last sentence of their intro text, often
 * after a hand-typed separator line ("----", "—", "⁂"). Until the
 * WordPress editing-note field is live and the intros are cleaned, the
 * note is split out here: the trailing sentence and any separator lines
 * before it leave the intro, and the note shows in the standard wording.
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
