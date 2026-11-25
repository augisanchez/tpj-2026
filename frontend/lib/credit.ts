const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** The credit line, unless the title already names the photographer
 *  (interviews are usually titled with the name), so it shows once. */
export function creditFor(title: string, photographer?: string | null): string | null {
  const name = photographer?.trim();
  if (!name) return null;
  return fold(title).includes(fold(name)) ? null : name;
}
