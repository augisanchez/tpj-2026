import { notFound } from "next/navigation";
import { PhotographerProfileBody } from "@/components/PhotographerProfileBody";
import { fetchPhotographerArticles } from "@/lib/queries/photographer-articles";
import { fetchPhotographerBySlug } from "@/lib/queries/photographer-by-slug";
import { normalizeSlug } from "@/lib/text-utils";
import type { Metadata } from "next";
import { describe, pageMetadata } from "@/lib/seo";

// Render each page on its first visit, then serve it from Vercel's
// cache (refreshed hourly, or immediately when WordPress saves). Without
// this the route renders on every request and every view hits the CMS.
export const revalidate = 3600;

export async function generateStaticParams() {
  return [];
}


type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = normalizeSlug((await params).slug);
  const p = await fetchPhotographerBySlug(slug);
  if (!p) return {};
  return pageMetadata({
    title: `${p.name} — The Photographic Journal`,
    description: describe(p.bio) ?? `Photographs and interviews by ${p.name} in The Photographic Journal.`,
    path: `/photographer/${p.slug}`,
    image: p.portrait,
    type: "profile",
  });
}

export default async function PhotographerPage({ params }: Props) {
  const slug = normalizeSlug((await params).slug);

  const [photographer, work] = await Promise.all([
    fetchPhotographerBySlug(slug),
    fetchPhotographerArticles(slug),
  ]);

  if (!photographer) notFound();

  return (
    <PhotographerProfileBody
      photographer={photographer}
      articles={work.articles}
      interviewsConducted={work.interviewsConducted}
    />
  );
}
