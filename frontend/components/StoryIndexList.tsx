"use client";

import { IndexPhotographerCard } from "./IndexPhotographerCard";
import { IndexThumbs } from "./IndexThumbs";
import styles from "./StoryIndex.module.css";

/** A profile a credit links to, with what its hover card shows. */
export type IndexPerson = {
  name: string;
  href: string;
  portrait: string | null;
  count: number;
};

/** One numbered story row. */
export type IndexRow = {
  /** Permanent catalogue number (oldest = No. 1), not the list position. */
  no: number;
  title: string;
  href: string;
  typeLabel: string;
  year: number;
  /** Plain-text credit, when it names no profile. */
  credit: string | null;
  /** The profile the credit names, when it is linked. */
  person: IndexPerson | null;
  /** Hover thumbnail URL. */
  image: string | null;
};

/**
 * The numbered story rows (Explore's List view), with the hover
 * thumbnail and the photographer card. Row markup is deliberately bare
 * (li > a > 5 spans) to keep several hundred rows light; the cells are
 * styled by position in StoryIndex.module.css.
 *
 * A credit that names a profile is its own link, laid over the row's
 * photographer column (links can't nest). Its third cell in the story
 * link stays empty so the positional cell styles still line up.
 */
export function StoryIndexList({
  rows,
  listId,
  label,
}: {
  rows: IndexRow[];
  /** id for the <ol>; the hover helpers find their rows through it. */
  listId: string;
  /** Accessible name for the list. */
  label: string;
}) {
  return (
    <>
      <div className={styles.cols} aria-hidden="true">
        <span>No.</span>
        <span>Title</span>
        <span>Photographer</span>
        <span>Type</span>
        <span>Year</span>
      </div>
      <ol className={styles.list} id={listId} aria-label={label}>
        {rows.map((r) => (
          <li key={r.no}>
            {/* Plain <a>: MotionRoot routes in-site clicks already. */}
            <a href={r.href}>
              <span>{`No. ${r.no}`}</span>
              <span>{r.title}</span>
              <span>{r.person ? null : r.credit}</span>
              <span>{r.typeLabel}</span>
              <span>{r.year}</span>
            </a>
            {r.person && <a href={r.person.href}>{r.person.name}</a>}
          </li>
        ))}
      </ol>
      <IndexThumbs listId={listId} rows={rows} />
      <IndexPhotographerCard listId={listId} rows={rows} />
    </>
  );
}
