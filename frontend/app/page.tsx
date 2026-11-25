import Link from "next/link";
import { ArchiveMosaic, type MosaicTile } from "@/components/ArchiveMosaic";
import { HomepageHeroCarousel, type HeroSlide } from "@/components/HomepageHeroCarousel";
import { InterviewQuoteRotator } from "@/components/InterviewQuoteRotator";
import { PurposeStatement } from "@/components/PurposeStatement";
import { RandomBand } from "@/components/RandomBand";
import { ScrollCue } from "@/components/ScrollCue";
import { ThemeBrowser } from "@/components/ThemeBrowser";
import { Ticker, type TickerItem } from "@/components/Ticker";
import { fetchArchivalArticles } from "@/lib/queries/archival-articles";
import { fetchArchiveCounts } from "@/lib/queries/archive-counts";
import { fetchThemeCounts } from "@/lib/queries/theme-counts";
import { fetchEssaysByThemes } from "@/lib/queries/essays-by-theme";
import { fetchFeaturedPhotographer } from "@/lib/queries/featured-photographer";
import { fetchHomepageQuotes } from "@/lib/queries/homepage-quotes";
import { fetchRecentEssays } from "@/lib/queries/recent-essays";
import {
  articleHref,
  articleLabel,
  fetchRecentArticles,
} from "@/lib/queries/recent-articles";
import { THEMES } from "@/lib/themes";
import { isCdnEnabled } from "@/lib/cdn";
import type { RecentEssay } from "@/lib/queries/recent-essays";
import type { Metadata } from "next";
import { pageMetadata, SITE_NAME, SITE_URL } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { SubmitMarquee } from "@/components/SubmitMarquee";
import styles from "./page.module.css";

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

export async function generateMetadata(): Promise<Metadata> {
  // Share image: the current lead story's photo.
  const [lead] = await fetchRecentArticles(1).catch(() => []);
  return pageMetadata({
    title: SITE_NAME,
    description:
      "The Photographic Journal publishes photo essays, photographer interviews, and topical features that explore creativity and artistic intent.",
    path: "/",
    image: lead?.featuredImage ?? null,
  });
}

export default async function Home() {
  const [
    essays,
    articles,
    archivalArticles,
    featuredPhotographer,
    interviewQuotes,
    taggedThemeGroups,
    themeCounts,
    archiveCounts,
  ] = await Promise.all([
    // Pool used as a fallback for themes with no/few tagged essays.
    // Each theme picks 3 of these per ISR cache window; 50 gives
    // enough variety that the 11 theme groups don't visibly overlap.
    fetchRecentEssays(50),
    fetchRecentArticles(15),
    // Older essays + interviews: the Revisit grid and hero slide 2.
    fetchArchivalArticles(80, 2),
    // Photographer flagged "Feature on homepage" in wp-admin, or null.
    fetchFeaturedPhotographer().catch(() => null),
    fetchHomepageQuotes(),
    // Real per-theme groupings from the tpj-theme taxonomy. Empty
    // arrays per slug before `wp tpj tag-themes` has run; the
    // buildThemeGroups fallback fills in from `essays` so the UI
    // still has cards.
    fetchEssaysByThemes(
      THEMES.map((t) => t.slug),
      7
    ),
    fetchThemeCounts().catch(() => ({} as Record<string, number>)),
    fetchArchiveCounts(),
  ]);
  const heroArticle = articles[0];
  const themePool = essays;
  const themeGroups = buildThemeGroups(taggedThemeGroups, themePool);
  // Covers 4-7 per theme feed the count tile's 2×2 mosaic.
  const themeExtras: Record<string, RecentEssay[]> = {};
  for (const theme of THEMES) {
    const shown = new Set((themeGroups[theme.slug] ?? []).map((e) => e.id));
    themeExtras[theme.slug] = (taggedThemeGroups[theme.slug] ?? []).filter(
      (e) => !shown.has(e.id)
    );
  }

  // Build the hero carousel slides. Three positions:
  //   1. Latest piece (whatever was just published — essay/interview/feature)
  //   2. From the archive (random pick >2 years old)
  //   3. Featured photographer (flagged on the photographer record)
  // Each slide degrades independently: missing latest → drop slide 1,
  // missing archival → drop slide 2, nothing flagged → fallback slide 3.
  // A single slide renders as a static hero (no carousel chrome).
  const heroSlides: HeroSlide[] = [];

  if (heroArticle) {
    heroSlides.push({
      key: `latest-${heroArticle.id}`,
      href: articleHref(heroArticle),
      contentTypeLabel: `Latest ${articleLabel(heroArticle)}`,
      title: heroArticle.title,
      date: heroArticle.date,
      excerpt: summarize(heroArticle.excerpt, 220),
      photographerName: heroArticle.photographerName,
      creditPrefix: heroArticle.contentType === "feature" ? "By" : undefined,
      backgroundImage: heroArticle.featuredImage ?? undefined,
    });
  }

  const archivalForHero = pickRandom(archivalArticles, 1)[0] ?? null;
  if (archivalForHero) {
    heroSlides.push({
      key: `archival-${archivalForHero.contentType}-${archivalForHero.id}`,
      href: articleHref(archivalForHero),
      contentTypeLabel: "Revisit",
      title: archivalForHero.title,
      date: archivalForHero.date,
      excerpt: summarize(archivalForHero.excerpt, 220),
      photographerName: archivalForHero.photographerName,
      backgroundImage: archivalForHero.featuredImage ?? undefined,
    });
  }

  // Slide 3: featured photographer. Name, the start of their bio, and
  // their portrait (or a cover from their work), linking to their profile. With nobody
  // flagged, fall back to the latest article of a different content type
  // than slide 1.
  if (featuredPhotographer) {
    heroSlides.push({
      key: `featured-photographer-${featuredPhotographer.slug}`,
      href: `/artist/${featuredPhotographer.slug}`,
      contentTypeLabel: "Featured Photographer",
      title: featuredPhotographer.name,
      excerpt: summarize(featuredPhotographer.bio, 220),
      backgroundImage: featuredPhotographer.image ?? undefined,
      collage: featuredPhotographer.collage ?? undefined,
      // Portraits are mostly upright head-and-shoulders: keep the face in frame.
      imageFocus: featuredPhotographer.imageIsPortrait ? "50% 22%" : undefined,
    });
  } else if (heroArticle) {
    const fallback = articles.find((a) => a.contentType !== heroArticle.contentType);
    if (fallback) {
      heroSlides.push({
        key: `fallback-${fallback.contentType}-${fallback.id}`,
        href: articleHref(fallback),
        contentTypeLabel: `Latest ${articleLabel(fallback)}`,
        title: fallback.title,
        date: fallback.date,
        excerpt: summarize(fallback.excerpt, 220),
        photographerName: fallback.photographerName,
        creditPrefix: fallback.contentType === "feature" ? "By" : undefined,
        backgroundImage: fallback.featuredImage ?? undefined,
      });
    }
  }

  // Ticker: the latest stories with a cover, minus any already on the
  // hero carousel.
  const heroHrefs = new Set(heroSlides.map((h) => h.href));
  const tickerItems: TickerItem[] = articles
    .filter((a) => a.featuredImage && !heroHrefs.has(articleHref(a)))
    .slice(0, 10)
    .map((a) => ({
      href: articleHref(a),
      title: a.title,
      photographer: a.photographerName,
      image: a.featuredImage!,
    }));

  // Anything already on the page (hero slides, ticker) stays out of the
  // Revisit grid.
  const seenHrefs = new Set<string>(
    [...heroHrefs, ...tickerItems.map((t) => t.href)]
  );

  // Revisit: pieces older than two years (the archival pool),
  // none repeated from the cards above.
  const mosaicPool = archivalArticles
    .filter((a) => a.featuredImage && !seenHrefs.has(articleHref(a)))
    .map((a): MosaicTile => ({
      href: articleHref(a),
      // With the image CDN on, Cloudflare sizes the original; otherwise use
      // the 600px thumbnail to keep tiles light.
      src: isCdnEnabled() ? a.featuredImage!.src : a.featuredImage!.thumb ?? a.featuredImage!.src,
      title: a.title,
      photographer: a.photographerName,
      contentType: a.contentType,
      year: a.date ? new Date(a.date).getFullYear() : null,
    }));
  const mosaicTiles = pickRandom(mosaicPool, 20);
  // Lead tiles (0 and 14) are large: full image; the rest get the 600px square.
  for (const i of [0, 14]) {
    if (!mosaicTiles[i]) continue;
    const lead = archivalArticles.find((x) => articleHref(x) === mosaicTiles[i].href);
    if (lead?.featuredImage) mosaicTiles[i] = { ...mosaicTiles[i], src: lead.featuredImage.src };
  }

  return (
    <div className={styles.homepage}>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: SITE_NAME,
          url: SITE_URL,
          potentialAction: {
            "@type": "SearchAction",
            target: `${SITE_URL}/search?q={search_term_string}`,
            "query-input": "required name=search_term_string",
          },
        }}
      />
      {heroSlides.length > 0 && <HomepageHeroCarousel slides={heroSlides} />}

      <ScrollCue />

      <PurposeStatement />

      {tickerItems.length > 0 && (
        <div>
          <div className={`${styles.wideSection} ${styles.sectionHeader}`}>
            <Link href="/explore" className={styles.exploreLink}>
              See everything
              <span className={styles.exploreArrow} aria-hidden="true">
                →
              </span>
            </Link>
          </div>
          <Ticker items={tickerItems} />
        </div>
      )}

      <RandomBand />

      <ThemeBrowser
        groups={themeGroups}
        extras={themeExtras}
        counts={themeCounts}
      />


      <InterviewQuoteRotator quotes={interviewQuotes} />

      {mosaicTiles.length >= 8 && (
        <ArchiveMosaic tiles={mosaicTiles} total={archiveCounts?.articles ?? null} />
      )}

      {/* Last thing before the footer, same as at the end of an essay. */}
      <SubmitMarquee />
    </div>
  );
}
