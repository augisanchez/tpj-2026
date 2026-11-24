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

export function pageMetadata({ title, description, path, image, type = "website", publishedTime, authors }: PageMeta): Metadata {
  const ogImage = image?.src ? cdnImageUrl(image.src, { width: 1200, quality: 80, format: "jpeg" }) : null;
  const images = ogImage ? [{ url: ogImage, alt: image?.alt || title }] : undefined;
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
    twitter: { card: images ? "summary_large_image" : "summary", title, description, images: images?.map((i) => i.url) },
  };
}
