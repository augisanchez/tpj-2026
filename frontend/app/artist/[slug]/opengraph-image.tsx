import { artistImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og";
import { fetchPhotographerBySlug } from "@/lib/queries/photographer-by-slug";
import { fetchPhotographerArticles } from "@/lib/queries/photographer-articles";

export const alt = "Work by this artist in The Photographic Journal";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [p, work] = await Promise.all([
    fetchPhotographerBySlug(slug).catch(() => null),
    fetchPhotographerArticles(slug).catch(() => null),
  ]);
  const covers = (work?.articles ?? [])
    .filter((a) => a.featuredImage)
    .map((a) => ({ src: a.featuredImage!.src }));
  return artistImage(p?.name ?? "Artist", covers, p?.portrait?.src ? { src: p.portrait.src } : null);
}
