import { NOT_FOUND_META } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { notFound } from "next/navigation";
import { ArticleEndMatter } from "@/components/ArticleEndMatter";
import { ArticlePrefooter } from "@/components/ArticlePrefooter";
import { ArticleBody } from "@/components/ArticleBody";
import { EssayIntro } from "@/components/EssayIntro";
import { Hero } from "@/components/Hero";
import { ReadingProgress } from "@/components/ReadingProgress";
import { RelatedArticles } from "@/components/RelatedArticles";
import { hangPlates } from "@/lib/exhibition";
import { formatPhotographerNames } from "@/lib/photographer-types";
import { fetchFeatureBySlug } from "@/lib/queries/feature-by-slug";
import { previewTarget } from "@/lib/preview";
import { fetchRecentFeatures } from "@/lib/queries/recent-features";
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

/**
 * Feature byline. The writer and the photographer are separate credits:
 * "Words by W  ·  Photographs by P". A review credits only its writer
 * (the reviewed artist isn't linked). One person doing both reads
 * "By X". With no credit, it's just the date.
 */
function buildFeatureByline(
  writer: string | null,
  photographer: string | null,
  formattedDate: string
): string {
  const parts: string[] = [];
  if (writer && photographer && writer !== photographer) {
    parts.push(`Words by ${writer}`, `Photographs by ${photographer}`);
  } else if (writer && photographer) {
    parts.push(`By ${writer}`);
  } else if (writer) {
    parts.push(`Words by ${writer}`);
  } else if (photographer) {
    parts.push(`Photographs by ${photographer}`);
  }
  parts.push(formattedDate);
  return parts.join("  ·  ");
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = normalizeSlug((await params).slug);
  if (slug.startsWith("preview-")) return { robots: { index: false } };
  const a = await fetchFeatureBySlug(slug);
  if (!a) return NOT_FOUND_META;
  const names = a.photographers.map((p) => p.name).filter(Boolean);
  return pageMetadata({
    title: `${a.title} — The Photographic Journal`,
    description: describe(a.intro, a.excerpt, a.body),
    path: `/feature/${a.slug}`,
    image: a.heroImage ?? a.featuredImage,
    type: "article",
    publishedTime: isoDate(a.date, a.dateGmt),
    authors: a.writer ? [a.writer] : names.length ? names : a.photographerName ? [a.photographerName] : undefined,
  });
}

export default async function FeaturePage({ params }: Props) {
  const slug = normalizeSlug((await params).slug);
  const [feature, recent] = await Promise.all([
    fetchFeatureBySlug(slug, await previewTarget("feature", slug)),
    fetchRecentFeatures(8),
  ]);

  if (!feature) notFound();

  const formattedDate = new Date(feature.date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const related = recent.filter((f) => f.slug !== feature.slug).slice(0, 3);

  const photographerDisplayName =
    formatPhotographerNames(feature.photographers.map((p) => p.name)) ??
    feature.photographerName;

  const byline = buildFeatureByline(
    feature.writer,
    photographerDisplayName,
    formattedDate
  );

  // Number the body photographs as plates (anchors + checklist).
  const { html: bodyHtml, plates } = hangPlates(feature.body);
  const year = new Date(feature.date).getFullYear() || null;

  return (
    <>
      <ReadingProgress />
      <JsonLd
        data={articleJsonLd({
          title: feature.title,
          path: `/feature/${feature.slug}`,
          section: "Features",
          sectionPath: "/explore?type=feature",
          description: describe(feature.intro, feature.excerpt, feature.body),
          image: feature.heroImage ?? feature.featuredImage,
          datePublished: isoDate(feature.date, feature.dateGmt),
          people: [...(feature.writer ? [{ name: feature.writer }] : []), ...feature.photographers.map((p) => ({ name: p.name, slug: p.slug }))],
        })}
      />
      <Hero
        contentTypeLabel="Feature"
        title={feature.title}
        byline={byline}
        backgroundImage={feature.heroImage ?? feature.featuredImage ?? undefined}
        wallLabel={{ photographer: photographerDisplayName, year, count: plates.length }}
      />

      {feature.intro && <EssayIntro text={feature.intro} />}

      <ArticleBody html={bodyHtml} />

      <ArticlePrefooter>
        <ArticleEndMatter
          photographers={feature.photographers}
          plates={plates}
          type="feature"
          credits={feature.credits}
        />

        <RelatedArticles
          eyebrow="More features"
          heading="Continue the thread"
          essays={related}
          contentTypeLabel="Feature"
          hrefBase="/feature"
        />
      </ArticlePrefooter>
    </>
  );
}
