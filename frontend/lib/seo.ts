import type { Metadata } from "next";
import { cdnImageUrl } from "./cdn";
import { htmlToPlainText } from "./text-utils";

export const SITE_NAME = "The Photographic Journal";
/** The public domain. Canonical URLs always point here, so the v2
 *  test domain never competes with it once the site launches. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://thephotographicjournal.com").replace(/\/$/, "");

/** First sentence-ish chunk of text, cut on a word boundary. */
export function describe(...sources: (string | null | undefined)[]): string | undefined {
  for (const src of sources) {
    const text = htmlToPlainText(src ?? "").replace(/\s+/g, " ").trim();
    if (text.length < 40) continue;
    if (text.length <= 160) return text;
    const cut = text.slice(0, 157);
    return cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:.\s]+$/, "") + "…";
  }
  return undefined;
}

type PageMeta = {
  title: string;
  description?: string;
  path: string;
  image?: { src: string; alt?: string } | null;
  type?: "article" | "profile" | "website";
  publishedTime?: string;
  authors?: string[];
};

/** Site-wide share image (public/og-default.jpg): the team's polaroid
 *  wall under the TPJ mark. Used wherever a page has no photo of its own. */
export const DEFAULT_SHARE_IMAGE = { url: "/og-default.jpg", width: 1200, height: 630, alt: SITE_NAME };

export function pageMetadata({ title, description, path, image, type = "website", publishedTime, authors }: PageMeta): Metadata {
  const ogImage = image?.src ? cdnImageUrl(image.src, { width: 1200, quality: 80, format: "jpeg" }) : null;
  const images = ogImage ? [{ url: ogImage, alt: image?.alt || title }] : [DEFAULT_SHARE_IMAGE];
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type,
      siteName: SITE_NAME,
      title,
      description,
      url: path,
      images,
      ...(type === "article" && publishedTime ? { publishedTime, authors } : {}),
    },
    twitter: { card: "summary_large_image", title, description, images: images.map((i) => i.url) },
  };
}

/** WordPress dates are local with no offset; dateGmt + "Z" is exact. */
export function isoDate(date: string | null | undefined, dateGmt?: string | null): string | undefined {
  if (dateGmt) return dateGmt.endsWith("Z") ? dateGmt : `${dateGmt}Z`;
  return date ?? undefined;
}

const PUBLISHER = {
  "@type": "Organization",
  name: SITE_NAME,
  url: SITE_URL,
  logo: { "@type": "ImageObject", url: `${SITE_URL}/svg/tpj_black.svg` },
};

/** Article + breadcrumb JSON-LD for essays, interviews and features. */
export function articleJsonLd(a: {
  title: string;
  path: string;
  section: string;
  sectionPath: string;
  description?: string;
  image?: { src: string } | null;
  datePublished?: string;
  people: { name: string; slug?: string }[];
}): object[] {
  const image = a.image?.src ? cdnImageUrl(a.image.src, { width: 1200, quality: 80, format: "jpeg" }) : null;
  return [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: a.title,
      url: `${SITE_URL}${a.path}`,
      mainEntityOfPage: `${SITE_URL}${a.path}`,
      ...(a.description ? { description: a.description } : {}),
      ...(image ? { image: [image] } : {}),
      ...(a.datePublished ? { datePublished: a.datePublished } : {}),
      author: a.people.map((p) => ({
        "@type": "Person",
        name: p.name,
        ...(p.slug ? { url: `${SITE_URL}/artist/${p.slug}` } : {}),
      })),
      publisher: PUBLISHER,
    },
    breadcrumbJsonLd([
      { name: a.section, path: a.sectionPath },
      { name: a.title, path: a.path },
    ]),
  ];
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]): object {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ name: SITE_NAME, path: "/" }, ...items].map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${SITE_URL}${it.path}`,
    })),
  };
}

/** Missing records: a clear title for the 404 page (Next adds noindex). */
export const NOT_FOUND_META: Metadata = { title: "Page not found — The Photographic Journal" };
