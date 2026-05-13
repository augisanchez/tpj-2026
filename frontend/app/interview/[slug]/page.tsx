import { notFound } from "next/navigation";
import { AboutPhotographerSection } from "@/components/AboutPhotographerSection";
import { EssayIntro } from "@/components/EssayIntro";
import { Hero } from "@/components/Hero";
import { InterviewBody } from "@/components/InterviewBody";
import { ReadingProgress } from "@/components/ReadingProgress";
import { RelatedArticles } from "@/components/RelatedArticles";
import { fetchInterviewBySlug } from "@/lib/queries/interview-by-slug";
import { fetchRecentInterviews } from "@/lib/queries/recent-interviews";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function InterviewPage({ params }: Props) {
  const { slug } = await params;
  const [interview, recent] = await Promise.all([
    fetchInterviewBySlug(slug),
    fetchRecentInterviews(8),
  ]);

  if (!interview) notFound();

  const formattedDate = new Date(interview.date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const related = recent.filter((i) => i.slug !== interview.slug).slice(0, 3);

  const photographerDisplayName =
    interview.photographer?.name ?? interview.photographerName;

  const bylineParts: string[] = [];
  if (interview.interviewer) {
    bylineParts.push(`Interview by ${interview.interviewer}`);
  }
  if (photographerDisplayName) {
    bylineParts.push(`Photographs by ${photographerDisplayName}`);
  }
  bylineParts.push(formattedDate);
  const byline = bylineParts.join("  ·  ");

  return (
    <>
      <ReadingProgress />
      <Hero
        contentTypeLabel="Interview"
        title={interview.title}
        byline={byline}
        backgroundImage={interview.heroImage ?? interview.featuredImage ?? undefined}
      />

      {interview.intro && <EssayIntro text={interview.intro} />}

      <InterviewBody html={interview.body} />

      {interview.photographers.length > 0 && (
        <AboutPhotographerSection photographers={interview.photographers} />
      )}

      <RelatedArticles
        eyebrow="More interviews"
        heading="Continue the thread"
        essays={related}
        contentTypeLabel="Interview"
        hrefBase="/interview"
      />
    </>
  );
}
