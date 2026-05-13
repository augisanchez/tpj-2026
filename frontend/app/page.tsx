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
import { fetchEssaysByThemes } from "@/lib/queries/essays-by-theme";
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
 * Stand-in article count per theme. Until Step 12 (AI theme tagging)
 * ships and real per-theme counts exist, deterministically hash the
 * slug into a plausible-looking value (18-32) so the homepage Theme
 * cards can render their collection badge with varied numbers instead
 * of every theme showing the same stand-in length of 3. Replace this
 * with the real per-theme fetch when tagging lands; the call site
 * doesn't need to change.
 */
function themeBadgeCount(slug: string): number {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return 18 + (hash % 15); // 18..32
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
 * Build a 3-essay group per theme. Prefers AI-tagged groupings
 * (Build Plan Step 12: `wp tpj tag-themes` writes tpj-theme taxonomy
 * terms via Claude classification). For any theme that has fewer
 * than 3 tagged essays, falls back to a random sample from the
 * recent-essays pool so the ThemeBrowser still has cards to render
 * during the transition period (or on a theme that genuinely doesn't
 * fit the archive's content). Once every theme has reliable
 * coverage, the random fallback path becomes dead code and can be
 * removed.
 */
function buildThemeGroups(
  taggedGroups: Record<string, RecentEssay[]>,
  themePool: RecentEssay[]
): Record<string, RecentEssay[]> {
  const result: Record<string, RecentEssay[]> = {};
  for (const theme of THEMES) {
    const tagged = taggedGroups[theme.slug] ?? [];
    if (tagged.length >= 3) {
      result[theme.slug] = tagged.slice(0, 3);
    } else if (tagged.length > 0) {
      // Partial coverage: combine tagged with a random top-up so the
      // group has 3 cards. Tagged ones lead.
      const have = new Set(tagged.map((e) => e.id));
      const filler = pickRandom(
        themePool.filter((e) => !have.has(e.id)),
        3 - tagged.length
      );
      result[theme.slug] = [...tagged, ...filler];
    } else {
      result[theme.slug] = pickRandom(themePool, 3);
    }
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
    taggedThemeGroups,
  ] = await Promise.all([
    // Pool used as a fallback for themes with no/few tagged essays.
    // Each theme picks 3 of these per ISR cache window; 50 gives
    // enough variety that the 11 theme groups don't visibly overlap.
    fetchRecentEssays(50),
    fetchRecentArticles(15),
    fetchSpotlightPhotographer(),
    fetchArchiveFeature(),
    fetchHomepageQuotes(),
    // Real per-theme groupings from the tpj-theme taxonomy. Empty
    // arrays per slug before `wp tpj tag-themes` has run; the
    // buildThemeGroups fallback fills in from `essays` so the UI
    // still has cards.
    fetchEssaysByThemes(
      THEMES.map((t) => t.slug),
      6
    ),
  ]);
  const spotlight = spotlightFromDb ?? FALLBACK_PHOTOGRAPHER;
  const heroArticle = articles[0];
  const exploreArticles = articles.slice(1, 4);
  const themePool = essays;
  const themeGroups = buildThemeGroups(taggedThemeGroups, themePool);

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
    badgeCount?: number;
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
      badgeCount: themeBadgeCount(theme.slug),
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
              badgeCount={card.badgeCount}
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
