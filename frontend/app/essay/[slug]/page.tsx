import { notFound } from "next/navigation";
import { AboutPhotographerSection } from "@/components/AboutPhotographerSection";
import { ArticleBody } from "@/components/ArticleBody";
import { EssayIntro } from "@/components/EssayIntro";
import { Hero } from "@/components/Hero";
import { ReadingProgress } from "@/components/ReadingProgress";
import { RelatedArticles } from "@/components/RelatedArticles";
import { fetchEssayBySlug } from "@/lib/queries/essay-by-slug";
import { fetchRecentEssays } from "@/lib/queries/recent-essays";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function EssayPage({ params }: Props) {
  const { slug } = await params;
  const [essay, recent] = await Promise.all([
    fetchEssayBySlug(slug),
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
    essay.photographer?.name ?? essay.photographerName;

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
        backgroundImage={essay.featuredImage ?? undefined}
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
