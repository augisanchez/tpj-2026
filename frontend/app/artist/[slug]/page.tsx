import { NOT_FOUND_META } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { notFound } from "next/navigation";
import { PhotographerProfileBody } from "@/components/PhotographerProfileBody";
import { fetchPhotographerArticles } from "@/lib/queries/photographer-articles";
import { fetchPhotographerBySlug } from "@/lib/queries/photographer-by-slug";
import { normalizeSlug } from "@/lib/text-utils";
import type { Metadata } from "next";
import { breadcrumbJsonLd, describe, pageMetadata, SITE_URL } from "@/lib/seo";

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
  if (!p) return NOT_FOUND_META;
  return pageMetadata({
    generatedImage: true,
    title: `${p.name} — The Photographic Journal`,
    description: describe(p.bio) ?? `Work by ${p.name} in The Photographic Journal.`,
    path: `/artist/${p.slug}`,
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
    <>
    <JsonLd
      data={[
        {
          "@context": "https://schema.org",
          "@type": "ProfilePage",
          url: `${SITE_URL}/artist/${photographer.slug}`,
          mainEntity: {
            "@type": "Person",
            name: photographer.name,
            ...(photographer.bio ? { description: photographer.bio.slice(0, 300) } : {}),
            ...(photographer.portrait?.src ? { image: photographer.portrait.src } : {}),
          },
        },
        breadcrumbJsonLd([
          { name: "Artists", path: "/artists" },
          { name: photographer.name, path: `/artist/${photographer.slug}` },
        ]),
      ]}
    />
    <PhotographerProfileBody
      photographer={photographer}
      articles={work.articles}
      interviewsConducted={work.interviewsConducted}
      appearsIn={work.appearsIn}
      featuresWritten={work.featuresWritten}
    />
    </>
  );
}
