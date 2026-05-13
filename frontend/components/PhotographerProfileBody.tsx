"use client";

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
};

// Cascade: cover -> identity -> bio/socials -> articles header ->
// articles grid. Container drives the stagger orchestration; each
// item is a motion.div that picks up the active variant via
// inheritance. Items lift 18px while fading in — slightly more
// than the page-level PageTransition fade (12px) so the per-section
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

export function PhotographerProfileBody({ photographer, articles }: Props) {
  const totalArticles = articles.length;

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
        totalArticles === 1 ? "article" : "articles"
      } in TPJ${startYear ? ` since ${startYear}` : ""}`
    );
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
          />
        </motion.div>

        <div className={styles.meta}>
          <motion.div className={styles.identity} variants={itemVariants}>
            <p className={styles.eyebrow}>Photographer</p>
            <h1 className={styles.name}>{photographer.name}</h1>
            {metaLine && <p className={styles.locationCount}>{metaLine}</p>}
            {photographer.representedBy && (
              <p className={styles.representedBy}>
                Represented by {photographer.representedBy}
              </p>
            )}
          </motion.div>

          <motion.div className={styles.bioColumn} variants={itemVariants}>
            {photographer.bio && (
              <p className={styles.bio}>{photographer.bio}</p>
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
        {articles.length > 0 ? (
          <>
            <p className={styles.articlesHead}>
              {totalArticles}{" "}
              {totalArticles === 1 ? "article" : "articles"}
            </p>
            <div className={styles.grid}>
              {articles.map((a) => (
                <ArticleCard
                  key={a.id}
                  variant="5up"
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
            heading={`No articles by ${photographer.name} in the archive yet.`}
            note="Check back after the next issue ships."
          />
        )}
      </motion.section>
    </motion.div>
  );
}
