"use client";

import { useState } from "react";
import { motion, type Variants } from "motion/react";
import { ArticleCard } from "./ArticleCard";
import { EmptyState } from "./EmptyState";
import { PhotographerAvatar } from "./PhotographerAvatar";
import styles from "./PhotographerProfile.module.css";
import type { Photographer } from "@/lib/queries/photographer-by-slug";
import type { PhotographerArticle } from "@/lib/queries/photographer-articles";

const TYPE_LABEL = {
  essay: "Photo Essay",
  interview: "Interview",
  feature: "Feature",
} as const;

type Props = {
  photographer: Photographer;
  articles: PhotographerArticle[];
  /** Interviews this person conducted. Empty for photographer-only profiles. */
  interviewsConducted?: PhotographerArticle[];
  /** Pieces someone else shot that this photographer appears in. */
  appearsIn?: PhotographerArticle[];
  featuresWritten?: PhotographerArticle[];
};

type View = "photographs" | "interviews" | "writing" | "appears";

// Cascade: cover -> identity -> bio/socials -> articles header ->
// articles grid. Container drives the stagger orchestration; each
// item is a motion.div that picks up the active variant via
// inheritance. Items lift 18px while fading in — slightly more
// than the page-level rise (16px) so the per-section
// arrival feels distinct from the overall route arrival.
const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.2, 0.6, 0.2, 1] },
  },
};

export function PhotographerProfileBody({
  photographer,
  articles,
  interviewsConducted = [],
  appearsIn = [],
  featuresWritten = [],
}: Props) {
  const totalArticles = articles.length;
  const totalInterviews = interviewsConducted.length;
  const totalAppears = appearsIn.length;
  const totalWritten = featuresWritten.length;
  const isInterviewer = totalInterviews > 0;
  // Tabs appear only when there's more than one body of work to switch
  // between. Photographs always lead when they exist.
  const views = (
    [
      ["photographs", "Photographs", totalArticles],
      ["interviews", "Interviews", totalInterviews],
      ["writing", "Writing", totalWritten],
      ["appears", "Appears in", totalAppears],
    ] as const
  ).filter(([key, , count]) => count > 0 || (key === "photographs" && totalInterviews + totalAppears + totalWritten === 0));
  const hasTabs = views.length > 1;
  const [view, setView] = useState<View>(views[0]?.[0] ?? "photographs");
  const shown =
    view === "interviews" ? interviewsConducted
      : view === "writing" ? featuresWritten
      : view === "appears" ? appearsIn
      : articles;

  // Earliest article year for the "since YYYY" line. Articles are sorted
  // newest first, so the last entry is oldest.
  const startYear =
    articles.length > 0
      ? new Date(articles[articles.length - 1].date).getFullYear()
      : null;

  // Meta line: location · article count line. Location reads from
  // tpj_location postmeta (exposed as `location` on Photographer).
  const metaSegments: string[] = [];
  if (photographer.location) {
    metaSegments.push(photographer.location);
  }
  if (totalArticles > 0) {
    metaSegments.push(
      `${totalArticles} ${
        totalArticles === 1 ? "story" : "stories"
      } in TPJ${startYear ? ` since ${startYear}` : ""}`
    );
  }
  if (isInterviewer) {
    metaSegments.push(
      `${totalInterviews} ${
        totalInterviews === 1 ? "interview" : "interviews"
      } conducted`
    );
  }
  if (totalWritten > 0) {
    metaSegments.push(`${totalWritten} ${totalWritten === 1 ? "feature" : "features"} written`);
  }
  if (totalAppears > 0) {
    metaSegments.push(`appears in ${totalAppears}`);
  }
  const metaLine = metaSegments.join("  ·  ");

  return (
    <motion.div
      className={styles.page}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <section className={styles.profile}>
        <motion.div className={styles.cover} variants={itemVariants}>
          <PhotographerAvatar
            name={photographer.name}
            portrait={photographer.portrait ?? undefined}
            className={styles.coverImage}
            sizes="(min-width: 1024px) 480px, 100vw"
            widths={[480, 768, 960, 1440]}
            priority
          />
        </motion.div>

        <div className={styles.meta}>
          <motion.div className={styles.identity} variants={itemVariants}>
            <p className={styles.eyebrow} data-reveal>
              {isInterviewer ? "Photographer & Interviewer" : "Photographer"}
            </p>
            <h1 className={styles.name} data-reveal="lines">{photographer.name}</h1>
            {metaLine && <p className={styles.locationCount}>{metaLine}</p>}
            {photographer.representedBy && (
              <p className={styles.representedBy}>
                Represented by {photographer.representedBy}
              </p>
            )}
          </motion.div>

          <motion.div className={styles.bioColumn} variants={itemVariants}>
            {photographer.bio && (
              <p className={styles.bio} data-reveal>{photographer.bio}</p>
            )}
            {photographer.socials.length > 0 && (
              <div className={styles.socials}>
                {photographer.socials.map((s) => (
                  <a
                    key={s.label}
                    className={styles.social}
                    href={s.href}
                    target={s.external ? "_blank" : undefined}
                    rel={s.external ? "noopener noreferrer" : undefined}
                  >
                    {s.label}
                    {s.external ? " ↗" : ""}
                  </a>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </section>

      <motion.section className={styles.articles} variants={itemVariants}>
        {hasTabs && (
          <div
            className={styles.viewSwitch}
            role="tablist"
            aria-label={`${photographer.name}'s work`}
          >
            {views.map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                role="tab"
                id={`view-${key}`}
                aria-selected={view === key}
                aria-controls="photographer-work"
                className={styles.viewTab}
                onClick={() => setView(key)}
              >
                {label} <span className={styles.viewCount}>{count}</span>
              </button>
            ))}
          </div>
        )}
        <div
          id="photographer-work"
          role={hasTabs ? "tabpanel" : undefined}
          aria-labelledby={hasTabs ? `view-${view}` : undefined}
          className={styles.workPanel}
        >
          {shown.length > 0 ? (
            <>
              {!hasTabs && (
                <p className={styles.articlesHead}>
                  {totalArticles}{" "}
                  {totalArticles === 1 ? "story" : "stories"}
                </p>
              )}
              <div className={styles.grid} data-reveal-children>
                {shown.map((a) => (
                  <ArticleCard
                    key={a.id}
                    variant="5up"
                    // The profile grid is three across the full width on
                    // desktop, two on tablets, one on phones.
                    sizes="(min-width: 1025px) 33vw, (min-width: 641px) 50vw, 100vw"
                    article={{
                      title: a.title,
                      date: a.date,
                      href: `/${a.contentType}/${a.slug}`,
                      contentTypeLabel: TYPE_LABEL[a.contentType],
                      featuredImage: a.featuredImage ?? undefined,
                    }}
                  />
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              heading={
                view === "interviews"
                  ? `No interviews by ${photographer.name} in the archive yet.`
                  : `No photographs by ${photographer.name} in the archive yet.`
              }
              note={
                hasTabs
                  ? undefined
                  : "Check back after the next issue ships."
              }
            />
          )}
        </div>
      </motion.section>
    </motion.div>
  );
}
