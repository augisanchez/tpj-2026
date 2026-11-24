import { notFound } from "next/navigation";
import { AboutPhotographerSection } from "@/components/AboutPhotographerSection";
import { ArticleBody } from "@/components/ArticleBody";
import { EssayIntro } from "@/components/EssayIntro";
import { Hero } from "@/components/Hero";
import { ReadingProgress } from "@/components/ReadingProgress";
import { RelatedArticles } from "@/components/RelatedArticles";
import { formatPhotographerNames } from "@/lib/photographer-types";
import { fetchEssayBySlug } from "@/lib/queries/essay-by-slug";
import { previewTarget } from "@/lib/preview";
import { fetchRecentEssays } from "@/lib/queries/recent-essays";
import { normalizeSlug } from "@/lib/text-utils";

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

  const related = recent.filter((e) => e.slug !== essay.slug).slice(0, 3);

  const photographerDisplayName =
    formatPhotographerNames(essay.photographers.map((p) => p.name)) ??
    essay.photographerName;

  return (
    <>
      <ReadingProgress />
      <Hero
        contentTypeLabel="Photo Essay"
        title={essay.title}
        byline={
          photographerDisplayName
            ? `Photographs by ${photographerDisplayName}  ·  ${formattedDate}`
            : formattedDate
        }
        backgroundImage={essay.heroImage ?? essay.featuredImage ?? undefined}
      />

      {essay.intro && <EssayIntro text={essay.intro} />}

      <ArticleBody html={essay.body} />

      {essay.photographers.length > 0 && (
        <AboutPhotographerSection photographers={essay.photographers} />
      )}

      <RelatedArticles
        eyebrow="More essays"
        heading="Continue the thread"
        essays={related}
      />
    </>
  );
}
