import { notFound } from "next/navigation";
import { AboutPhotographerSection } from "@/components/AboutPhotographerSection";
import { ArticleBody } from "@/components/ArticleBody";
import { EssayIntro } from "@/components/EssayIntro";
import { Hero } from "@/components/Hero";
import { ReadingProgress } from "@/components/ReadingProgress";
import { RelatedArticles } from "@/components/RelatedArticles";
import { fetchFeatureBySlug } from "@/lib/queries/feature-by-slug";
import { fetchRecentFeatures } from "@/lib/queries/recent-features";

type Props = {
  params: Promise<{ slug: string }>;
};

/**
 * Compose the Feature byline from up to three pieces:
 *   - Writer: "Words by {name}" — present for written Features.
 *   - Photographer: "Photographs by {name}" — present for photo-led
 *     Features (and most legacy Features).
 *   - Date: always present.
 * Pieces join with " · ". When no writer or photographer credit
 * exists, the byline is just the date.
 */
function buildFeatureByline(
  writer: string | null,
  photographer: string | null,
  formattedDate: string
): string {
  const parts: string[] = [];
  if (writer) parts.push(`Words by ${writer}`);
  if (photographer) parts.push(`Photographs by ${photographer}`);
  parts.push(formattedDate);
  return parts.join("  ·  ");
}

export default async function FeaturePage({ params }: Props) {
  const { slug } = await params;
  const [feature, recent] = await Promise.all([
    fetchFeatureBySlug(slug),
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
    feature.photographer?.name ?? feature.photographerName;

  const byline = buildFeatureByline(
    feature.writer,
    photographerDisplayName,
    formattedDate
  );

  return (
    <>
      <ReadingProgress />
      <Hero
        contentTypeLabel="Feature"
        title={feature.title}
        byline={byline}
        backgroundImage={feature.featuredImage ?? undefined}
      />

      {feature.intro && <EssayIntro text={feature.intro} narrow />}

      <ArticleBody html={feature.body} centered />

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
