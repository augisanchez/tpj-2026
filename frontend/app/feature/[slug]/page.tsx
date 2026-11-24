import { NOT_FOUND_META } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { notFound } from "next/navigation";
import { AboutPhotographerSection } from "@/components/AboutPhotographerSection";
import { ArticleBody } from "@/components/ArticleBody";
import { EssayIntro } from "@/components/EssayIntro";
import { ExhibitionChecklist } from "@/components/ExhibitionChecklist";
import { Hero } from "@/components/Hero";
import { ReadingProgress } from "@/components/ReadingProgress";
import { RelatedArticles } from "@/components/RelatedArticles";
import { hangPlates } from "@/lib/exhibition";
import { accentFor } from "@/lib/accent";
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
 * Feature byline: "By {names}" · date. Features range from reviews to
 * photo-led pieces, so the credit stays neutral ("By") rather than
 * claiming words or photographs. Writer and photographer are both
 * credited when they differ. With no credit, it's just the date.
 */
function buildFeatureByline(
  writer: string | null,
  photographer: string | null,
  formattedDate: string
): string {
  const names = [writer, photographer].filter(
    (n, i, all): n is string => Boolean(n) && all.indexOf(n) === i
  );
  const parts: string[] = [];
  if (names.length) parts.push(`By ${names.join(" and ")}`);
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
    authors: names.length ? names : a.photographerName ? [a.photographerName] : undefined,
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

      <ExhibitionChecklist plates={plates} accent={accentFor(feature.slug)} />

      {feature.photographers.length > 0 && (
        <AboutPhotographerSection photographers={feature.photographers} />
      )}

      <RelatedArticles
        eyebrow="More features"
        heading="Continue the thread"
        essays={related}
        contentTypeLabel="Feature"
        hrefBase="/feature"
      />
    </>
  );
}
