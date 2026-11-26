import { NOT_FOUND_META } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { notFound } from "next/navigation";
import { ArticleEndMatter } from "@/components/ArticleEndMatter";
import { ArticlePrefooter } from "@/components/ArticlePrefooter";
import { ArticleBody } from "@/components/ArticleBody";
import { EssayIntro } from "@/components/EssayIntro";
import { Hero } from "@/components/Hero";
import { PlateCounter } from "@/components/PlateCounter";
import { ReadingProgress } from "@/components/ReadingProgress";
import { RelatedStrip } from "@/components/RelatedStrip";
import { SubmitMarquee } from "@/components/SubmitMarquee";
import { hangPlates } from "@/lib/exhibition";
import { formatPhotographerNames } from "@/lib/photographer-types";
import { fetchEssayBySlug } from "@/lib/queries/essay-by-slug";
import { previewTarget } from "@/lib/preview";
import { fetchRecentEssays } from "@/lib/queries/recent-essays";
import { fetchRelatedStories } from "@/lib/queries/related-stories";
import { normalizeSlug } from "@/lib/text-utils";
import type { Metadata } from "next";
import { describe, pageMetadata, articleJsonLd, isoDate } from "@/lib/seo";

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
  if (slug.startsWith("preview-")) return { robots: { index: false } };
  const a = await fetchEssayBySlug(slug);
  if (!a) return NOT_FOUND_META;
  const names = a.photographers.map((p) => p.name).filter(Boolean);
  return pageMetadata({
    title: `${a.title} — The Photographic Journal`,
    description: describe(a.summary, a.intro, a.excerpt, a.body),
    path: `/essay/${a.slug}`,
    image: a.heroImage ?? a.featuredImage,
    type: "article",
    publishedTime: isoDate(a.date, a.dateGmt),
    authors: names.length ? names : a.photographerName ? [a.photographerName] : undefined,
  });
}

export default async function EssayPage({ params }: Props) {
  const slug = normalizeSlug((await params).slug);
  const [essay, recent] = await Promise.all([
    fetchEssayBySlug(slug, await previewTarget("essay", slug)),
    fetchRecentEssays(8),
  ]);

  if (!essay) notFound();

  const formattedDate = new Date(essay.date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Same photographer first, then same theme, then recent essays.
  const related = await fetchRelatedStories(essay, recent);

  const photographerDisplayName =
    formatPhotographerNames(essay.photographers.map((p) => p.name)) ??
    essay.photographerName;

  // Number the body photographs as plates (anchors + checklist).
  const { html: bodyHtml, plates } = hangPlates(essay.body);
  const year = new Date(essay.date).getFullYear() || null;

  return (
    <>
      <ReadingProgress />
      <JsonLd
        data={articleJsonLd({
          title: essay.title,
          path: `/essay/${essay.slug}`,
          section: "Photo Essays",
          sectionPath: "/explore?type=essay",
          description: describe(essay.summary, essay.intro, essay.excerpt, essay.body),
          image: essay.heroImage ?? essay.featuredImage,
          datePublished: isoDate(essay.date, essay.dateGmt),
          people: essay.photographers.map((p) => ({ name: p.name, slug: p.slug })),
        })}
      />
      <Hero
        contentTypeLabel="Photo Essay"
        title={essay.title}
        byline={
          photographerDisplayName
            ? `Photographs by ${photographerDisplayName}`
            : formattedDate
        }
        backgroundImage={essay.heroImage ?? essay.featuredImage ?? undefined}
        wallLabel={{ photographer: photographerDisplayName, year, count: plates.length }}
      />

      {essay.intro && <EssayIntro text={essay.intro} />}

      <ArticleBody html={bodyHtml} />
      <PlateCounter total={plates.length} />

      <ArticlePrefooter>
        <ArticleEndMatter
          photographers={essay.photographers}
          plates={plates}
          type="essay"
          credits={essay.credits}
        />

        <RelatedStrip label="Related stories" stories={related} />
      </ArticlePrefooter>
      <SubmitMarquee prefooter />
    </>
  );
}
