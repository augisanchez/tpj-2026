import { NOT_FOUND_META } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { notFound } from "next/navigation";
import { ArticleEndMatter } from "@/components/ArticleEndMatter";
import { ArticlePrefooter } from "@/components/ArticlePrefooter";
import { EssayIntro } from "@/components/EssayIntro";
import { Hero } from "@/components/Hero";
import { InterviewBody } from "@/components/InterviewBody";
import { ReadingProgress } from "@/components/ReadingProgress";
import { ContinueThread } from "@/components/ContinueThread";
import { buildThread, fetchArtistMore, fromRecent } from "@/lib/queries/related-stories";
import { hangPlates } from "@/lib/exhibition";
import { formatPhotographerNames } from "@/lib/photographer-types";
import { fetchInterviewBySlug } from "@/lib/queries/interview-by-slug";
import { previewTarget } from "@/lib/preview";
import { fetchRecentInterviews } from "@/lib/queries/recent-interviews";
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
  const a = await fetchInterviewBySlug(slug);
  if (!a) return NOT_FOUND_META;
  const names = a.photographers.map((p) => p.name).filter(Boolean);
  return pageMetadata({
    title: `${a.title} — The Photographic Journal`,
    description: describe(a.summary, a.intro, a.excerpt, a.body),
    path: `/interview/${a.slug}`,
    image: a.heroImage ?? a.featuredImage,
    type: "article",
    publishedTime: isoDate(a.date, a.dateGmt),
    authors: names.length ? names : a.photographerName ? [a.photographerName] : undefined,
  });
}

export default async function InterviewPage({ params }: Props) {
  const slug = normalizeSlug((await params).slug);
  const [interview, recent] = await Promise.all([
    fetchInterviewBySlug(slug, await previewTarget("interview", slug)),
    fetchRecentInterviews(8),
  ]);

  if (!interview) notFound();

  const formattedDate = new Date(interview.date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // The artist's other work (for their bio's "more" link and the first
  // thread cards), then recent interviews.
  const here = `/interview/${interview.slug}`;
  const artists = await fetchArtistMore(interview.photographers, here);
  const related = buildThread({
    currentType: "interview",
    currentHref: here,
    artists,
    recent: recent.map((r) => fromRecent(r, "interview")),
    slots: 3,
  });

  const photographerDisplayName =
    formatPhotographerNames(interview.photographers.map((p) => p.name)) ??
    interview.photographerName;

  const bylineParts: string[] = [];
  if (interview.interviewer) {
    bylineParts.push(`Interview by ${interview.interviewer}`);
  }
  if (photographerDisplayName) {
    bylineParts.push(`Photographs by ${photographerDisplayName}`);
  }
  bylineParts.push(formattedDate);
  const byline = bylineParts.join("  ·  ");

  // Number the body photographs as plates (anchors + checklist).
  const { html: bodyHtml, plates } = hangPlates(interview.body);
  const year = new Date(interview.date).getFullYear() || null;

  return (
    <>
      <ReadingProgress />
      <JsonLd
        data={articleJsonLd({
          title: interview.title,
          path: `/interview/${interview.slug}`,
          section: "Interviews",
          sectionPath: "/explore?type=interview",
          description: describe(interview.summary, interview.intro, interview.excerpt, interview.body),
          image: interview.heroImage ?? interview.featuredImage,
          datePublished: isoDate(interview.date, interview.dateGmt),
          people: interview.photographers.map((p) => ({ name: p.name, slug: p.slug })),
        })}
      />
      <Hero
        contentTypeLabel="Interview"
        title={interview.title}
        byline={byline}
        credit={interview.portraitCredit}
        backgroundImage={interview.heroImage ?? interview.featuredImage ?? undefined}
        wallLabel={{ photographer: photographerDisplayName, year, count: plates.length }}
      />

      <EssayIntro text={interview.intro} note={interview.editorialNote} />

      <InterviewBody html={bodyHtml} />

      <ArticlePrefooter>
        <ArticleEndMatter
          photographers={interview.photographers}
          plates={plates}
          type="interview"
          credits={interview.credits}
          more={artists}
        />

        <ContinueThread variant="row" stories={related} currentHref={here} />
      </ArticlePrefooter>
    </>
  );
}
