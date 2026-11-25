/**
 * Turns whatever an editor typed into a social field into a well-formed
 * link, or drops it. Editors type handles ("louobedlam", "@louobedlam"),
 * bare domains ("blog.louobedlam.com"), full URLs, and sometimes a URL
 * for the wrong platform in a field. Every artist social link on the
 * site goes through here.
 *
 * Rules:
 *  - Handles get the platform's profile URL.
 *  - Bare domains get https://.
 *  - Known platforms are always https, with no doubled slashes and no
 *    whitespace. Anything that doesn't parse as a URL is dropped.
 *  - A URL for another platform is labelled by where it actually goes
 *    (an Instagram URL typed into the Flickr field shows as Instagram).
 *  - Duplicates (same destination twice) show once.
 */

export type SocialField =
  | "website"
  | "instagram"
  | "twitter"
  | "facebook"
  | "tumblr"
  | "flickr"
  | "vsco"
  | "vimeo"
  | "blog"
  | "bluesky"
  | "threads"
  | "linkedin";

type Platform = { label: string; hosts: string[]; profile?: (handle: string) => string };

const PLATFORMS: Record<SocialField, Platform> = {
  website: { label: "Website", hosts: [] },
  blog: { label: "Blog", hosts: [] },
  instagram: { label: "Instagram", hosts: ["instagram.com"], profile: (h) => `https://www.instagram.com/${h}/` },
  twitter: { label: "Twitter", hosts: ["twitter.com", "x.com"], profile: (h) => `https://twitter.com/${h}` },
  facebook: { label: "Facebook", hosts: ["facebook.com", "fb.com"], profile: (h) => `https://www.facebook.com/${h}` },
  tumblr: { label: "Tumblr", hosts: ["tumblr.com"], profile: (h) => `https://${h}.tumblr.com/` },
  flickr: { label: "Flickr", hosts: ["flickr.com", "flic.kr"], profile: (h) => `https://www.flickr.com/people/${h}/` },
  vsco: { label: "VSCO", hosts: ["vsco.co"], profile: (h) => `https://vsco.co/${h}` },
  vimeo: { label: "Vimeo", hosts: ["vimeo.com"], profile: (h) => `https://vimeo.com/${h}` },
  bluesky: { label: "Bluesky", hosts: ["bsky.app"], profile: (h) => `https://bsky.app/profile/${h.includes(".") ? h : `${h}.bsky.social`}` },
  threads: { label: "Threads", hosts: ["threads.net", "threads.com"], profile: (h) => `https://www.threads.net/@${h}` },
  linkedin: { label: "LinkedIn", hosts: ["linkedin.com"], profile: (h) => `https://www.linkedin.com/in/${h}` },
};

/** Endings that mark "blog.lou.com" as a domain, not a handle like "ph.joepansa". */
const COMMON_TLDS = new Set("com net org co io me art blog photo photos photography studio gallery design info xyz tv us uk ca au nz ie de fr es it nl be ch at se no dk fi pt pl cz jp kr mx br ar cl".split(" "));

const ORDER: SocialField[] = ["website", "instagram", "twitter", "facebook", "flickr", "tumblr", "vsco", "vimeo", "blog", "bluesky", "threads", "linkedin"];

const hostMatches = (host: string, hosts: string[]) => hosts.some((h) => host === h || host.endsWith("." + h));

/** The platform a URL actually points at, if it's one we know. */
function platformOf(host: string): SocialField | null {
  for (const f of ORDER) if (PLATFORMS[f].hosts.length && hostMatches(host, PLATFORMS[f].hosts)) return f;
  return null;
}

/** One field's value as a clean URL, or null when it can't be one. */
export function normalizeSocialUrl(raw: string | null | undefined, field: SocialField): string | null {
  let v = (raw ?? "").trim().replace(/^[<"'(]+|[>"')]+$/g, "").replace(/\s+/g, "");
  if (!v) return null;
  const p = PLATFORMS[field];

  const looksLikeUrl = /^[a-z][a-z0-9+.-]*:\/\//i.test(v) || /^\/\//.test(v);
  // A domain with a dot before the first slash and a real TLD: "blog.lou.com",
  // "flickr.com//louobedlam", "www.site.co/x". Not "ph.joepansa" in a platform
  // field, which is a handle with a dot in it.
  const host0 = v.split("/")[0].toLowerCase();
  const looksLikeDomain =
    /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(\/|$)/i.test(v) &&
    (!p.profile || /\//.test(v) || /^www\./i.test(v) || hostMatches(host0, p.hosts) || platformOf(host0) !== null || COMMON_TLDS.has(host0.split(".").pop() ?? ""));

  if (looksLikeUrl) {
    if (v.startsWith("//")) v = "https:" + v;
  } else if (looksLikeDomain || !p.profile) {
    v = "https://" + v.replace(/^\/+/, "");
  } else {
    const handle = v.replace(/^@+/, "").replace(/^\/+|\/+$/g, "");
    if (!handle || /[^\w.\-@]/.test(handle)) return null;
    v = p.profile(handle);
  }

  let u: URL;
  try {
    u = new URL(v);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (!u.hostname.includes(".")) return null;
  u.hostname = u.hostname.toLowerCase();
  u.pathname = u.pathname.replace(/\/{2,}/g, "/");
  // "flickr.com/louobedlam" isn't a Flickr page; profiles live under
  // /people/ or /photos/.
  if (hostMatches(u.hostname, PLATFORMS.flickr.hosts) && u.hostname !== "flic.kr") {
    const seg = u.pathname.split("/").filter(Boolean);
    if (seg.length === 1 && !["people", "photos", "groups", "explore"].includes(seg[0].toLowerCase())) {
      u.pathname = `/people/${seg[0]}/`;
    }
  }
  // Known platforms all serve https; personal sites keep what they had
  // only if they were explicitly http and we can't know better. Upgrade
  // anyway: browsers warn on http, and nearly every host redirects.
  u.protocol = "https:";
  return u.toString();
}

export type SocialLink = { label: string; href: string; external: true };

/** Every non-empty field, cleaned, labelled by real destination, deduped. */
export function buildSocialLinks(fields: Partial<Record<SocialField, string | null>>): SocialLink[] {
  const out: SocialLink[] = [];
  const seen = new Set<string>();
  for (const field of ORDER) {
    const href = normalizeSocialUrl(fields[field], field);
    if (!href) continue;
    const key = href.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const actual = platformOf(new URL(href).hostname);
    // Tumblr blogs often run on their own domain; keep the Tumblr label.
    const label = actual
      ? PLATFORMS[actual].label
      : field === "tumblr" || !PLATFORMS[field].hosts.length
        ? PLATFORMS[field].label
        : "Website";
    out.push({ label, href, external: true });
  }
  return out;
}
