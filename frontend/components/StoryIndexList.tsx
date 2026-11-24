"use client";

import { IndexThumbs } from "./IndexThumbs";
import styles from "./StoryIndex.module.css";

/** [no, title, photographer, type, year, slug, accent, image tail] */
export type IndexRow = [number, string, string, 0 | 1 | 2, number, string, string, string];

const TYPES = [
  ["essay", "Essay"],
  ["interview", "Interview"],
  ["feature", "Feature"],
] as const;

const LIST_ID = "story-index";

/**
 * The index rows, rendered from compact tuples. A client component on
 * purpose: the server would otherwise ship every row twice (as HTML and
 * again as React element JSON in the page payload). Tuples are about a
 * third of that JSON. The HTML is still fully server-rendered, so every
 * story is a real link before any script runs.
 */
export function StoryIndexList({ rows, prefix }: { rows: IndexRow[]; prefix: string }) {
  return (
    <>
      <ol className={styles.list} id={LIST_ID} aria-label={`${rows.length} stories, newest first`}>
        {rows.map(([no, title, photographer, type, year, slug, accent]) => (
          <li key={no}>
            {/* Plain <a>: MotionRoot routes in-site clicks already. */}
            <a href={`/${TYPES[type][0]}/${slug}`} data-accent={accent}>
              <span>{`No. ${no}`}</span>
              <span>{title}</span>
              <span>{photographer}</span>
              <span>{TYPES[type][1]}</span>
              <span>{year}</span>
            </a>
          </li>
        ))}
      </ol>
      <IndexThumbs listId={LIST_ID} prefix={prefix} tails={rows.map((r) => r[7])} />
    </>
  );
}
