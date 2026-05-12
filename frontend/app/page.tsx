import type { CSSProperties } from "react";
import Link from "next/link";
import { ArticleCard } from "@/components/ArticleCard";
import { HomepageHero } from "@/components/HomepageHero";
import { InterviewQuoteRotator } from "@/components/InterviewQuoteRotator";
import { PurposeStatement } from "@/components/PurposeStatement";
import { ScrollCue } from "@/components/ScrollCue";
import { StaggerReveal } from "@/components/StaggerReveal";
import { ThemeBrowser } from "@/components/ThemeBrowser";
import { FALLBACK_PHOTOGRAPHER } from "@/lib/photographer-fallback";
import { fetchArchiveFeature } from "@/lib/queries/archive-feature";
import { fetchHomepageQuotes } from "@/lib/queries/homepage-quotes";
import { fetchRecentEssays } from "@/lib/queries/recent-essays";
import {
  articleHref,
  articleLabel,
  fetchRecentArticles,
} from "@/lib/queries/recent-articles";
import { fetchSpotlightPhotographer } from "@/lib/queries/spotlight-photographer";
import { THEMES } from "@/lib/themes";
import type { RecentEssay } from "@/lib/queries/recent-essays";
import styles from "./page.module.css";

const ARCHIVE_TYPE_LABEL = {
  essay: "Photo Essay",
  interview: "Interview",
  feature: "Feature",
} as const;

function summarize(
  text: string | null | undefined,
  maxChars: number
): string | undefined {
  if (!text) return undefined;
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;
  const cutoff = trimmed.slice(0, maxChars);
  const lastSpace = cutoff.lastIndexOf(" ");
  if (lastSpace > maxChars * 0.6) {
    return cutoff.slice(0, lastSpace).trimEnd() + "…";
  }
  return cutoff.trimEnd() + "…";
}

/**
 * Random sample of `n` items from `pool` without duplicates within the
 * sample. Returns fewer when the pool is short.
 */
function pickRandom<T>(pool: T[], n: number): T[] {
  if (pool.length === 0) return [];
  const copy = [...pool];
  const out: T[] = [];
  const count = Math.min(n, copy.length);
  for (let i = 0; i < count; i++) {
    const j = Math.floor(Math.random() * copy.length);
    out.push(copy[j]);
    copy.splice(j, 1);
  }
  return out;
}

/**
 * Build a 3-essay group per theme. Until per-theme tagging ships (Build
 * Plan Step 12), each theme pulls a random sample from the recent
 * essays pool rather than a deterministic slice — surfaces a wider mix
 * of the archive across page loads (within the ISR cache window) and
 * makes chip switches feel less like the same pool reordered. When
 * real tagging lands, swap this for a theme-filtered fetch.
 */
function buildThemeGroups(
  themePool: RecentEssay[]
): Record<string, RecentEssay[]> {
  const result: Record<string, RecentEssay[]> = {};
  for (const theme of THEMES) {
    result[theme.slug] = pickRandom(themePool, 3);
  }
  return result;
}

export default async function Home() {
  const [
    essays,
    articles,
    spotlightFromDb,
    archiveFeature,
    interviewQuotes,
  ] = await Promise.all([
    // Pool used for the ThemeBrowser random sampling. Each theme picks
    // 3 of these per ISR cache window; 50 gives enough variety that the
    // 11 theme groups don't visibly overlap.
    fetchRecentEssays(50),
    fetchRecentArticles(15),
    fetchSpotlightPhotographer(),
    fetchArchiveFeature(),
    fetchHomepageQuotes(),
  ]);
  const spotlight = spotlightFromDb ?? FALLBACK_PHOTOGRAPHER;
  const heroArticle = articles[0];
  const exploreArticles = articles.slice(1, 4);
  const themePool = essays;
  const themeGroups = buildThemeGroups(themePool);

  // Dive Deeper: 6 cards in two rows. Mix of curated entry points
  // (photographer spotlight, archive feature) and discovery prompts
  // (themes, recent essays) so the section spans the archive instead
  // of repeating Keep Exploring.
  const featuredCards: Array<{
    key: string;
    title: string;
    date: string;
    href: string;
    contentTypeLabel: string;
    description?: string;
    showDate: boolean;
    featuredImage?: { src: string; alt: string };
    stacked?: boolean;
  }> = [];

  featuredCards.push({
    key: "photographer",
    title: spotlight.name,
    date: new Date().toISOString(),
    href: `/photographer/${spotlight.slug}`,
    contentTypeLabel: "Photographer",
    description: summarize(spotlight.bio, 160),
    showDate: false,
    featuredImage: spotlight.portrait ?? undefined,
  });

  if (archiveFeature) {
    featuredCards.push({
      key: "archive",
      title: archiveFeature.title,
      date: archiveFeature.date,
      href: archiveFeature.href,
      contentTypeLabel: ARCHIVE_TYPE_LABEL[archiveFeature.type],
      description: summarize(archiveFeature.excerpt, 160),
      showDate: true,
      featuredImage: archiveFeature.featuredImage ?? undefined,
    });
  }

  // Two random themes, each with a cover image borrowed from its
  // (stand-in) essay group until per-theme tagging ships.
  const featuredThemes = pickRandom(THEMES, 2);
  for (const theme of featuredThemes) {
    const themeCover = themeGroups[theme.slug]?.[0]?.featuredImage ?? undefined;
    featuredCards.push({
      key: `theme-${theme.slug}`,
      title: theme.name,
      date: new Date().toISOString(),
      href: `/theme/${theme.slug}`,
      contentTypeLabel: "Theme",
      description: theme.prompt,
      showDate: false,
      featuredImage: themeCover,
      stacked: true,
    });
  }

  // Two random essays from the pool, excluding anything already shown
  // anywhere on the page (hero, Keep Exploring, the archive feature
  // already added to featuredCards above). Dedup by href because the
  // recent-articles and recent-essays queries return different GraphQL
  // global-id shapes for the same post; href is the only stable join.
  const shownHrefs = new Set<string>([
    heroArticle ? articleHref(heroArticle) : null,
    ...exploreArticles.map(articleHref),
    ...featuredCards.map((c) => c.href),
  ].filter((x): x is string => Boolean(x)));
  const essayCandidates = essays.filter(
    (e) => !shownHrefs.has(`/essay/${e.slug}`)
  );
  const featuredEssays = pickRandom(essayCandidates, 2);
  for (const essay of featuredEssays) {
    featuredCards.push({
      key: `essay-${essay.id}`,
      title: essay.title,
      date: essay.date,
      href: `/essay/${essay.slug}`,
      contentTypeLabel: "Photo Essay",
      description: summarize(essay.excerpt, 160),
      showDate: true,
      featuredImage: essay.featuredImage ?? undefined,
    });
  }

  // Final safety net: drop any featuredCards that duplicate the hero
  // or Keep Exploring rows. Keeps Dive Deeper feeling like a distinct
  // surface rather than a continuation of the recent feed.
  const seenHrefs = new Set<string>([
    heroArticle ? articleHref(heroArticle) : null,
    ...exploreArticles.map(articleHref),
  ].filter((x): x is string => Boolean(x)));
  const dedupedFeaturedCards = featuredCards.filter((c) => {
    if (seenHrefs.has(c.href)) return false;
    seenHrefs.add(c.href);
    return true;
  });

  return (
    <div className={styles.homepage}>
      {heroArticle && (
        <HomepageHero
          href={articleHref(heroArticle)}
          contentTypeLabel={articleLabel(heroArticle)}
          title={heroArticle.title}
          date={heroArticle.date}
          excerpt={summarize(heroArticle.excerpt, 220)}
          photographerName={heroArticle.photographerName}
          backgroundImage={heroArticle.featuredImage ?? undefined}
        />
      )}

      <ScrollCue />

      <PurposeStatement />

      <section className={styles.wideSection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.eyebrow}>Keep Exploring</h2>
          <Link href="/explore" className={styles.exploreLink}>
            Explore all
            <span className={styles.exploreArrow} aria-hidden="true">
              →
            </span>
          </Link>
        </div>

        <StaggerReveal className={styles.latestGrid}>
          {exploreArticles.map((article) => (
            <ArticleCard
              key={article.id}
              variant="3up"
              article={{
                title: article.title,
                date: article.date,
                href: articleHref(article),
                contentTypeLabel: articleLabel(article),
                featuredImage: article.featuredImage ?? undefined,
              }}
            />
          ))}
        </StaggerReveal>
      </section>

      <ThemeBrowser groups={themeGroups} />

      <InterviewQuoteRotator quotes={interviewQuotes} />

      <section className={styles.wideSection}>
        <div className={styles.featuredHeader}>
          <h2 className={styles.featuredTitle}>Dive Deeper</h2>
          <p className={styles.featuredDescription}>
            More ways further in.
          </p>
        </div>

        <StaggerReveal
          className={styles.featuredGrid}
          step={120}
        >
          {dedupedFeaturedCards.map((card) => (
            <ArticleCard
              key={card.key}
              variant="3up"
              showDate={card.showDate}
              stacked={card.stacked}
              article={{
                title: card.title,
                date: card.date,
                href: card.href,
                contentTypeLabel: card.contentTypeLabel,
                description: card.description,
                featuredImage: card.featuredImage,
              }}
            />
          ))}
        </StaggerReveal>
      </section>
    </div>
  );
}
