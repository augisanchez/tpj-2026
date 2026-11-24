"use client";

import { slugifyName } from "@/lib/text-utils";
import { IndexPhotographerCard } from "./IndexPhotographerCard";
import { IndexThumbs } from "./IndexThumbs";
import styles from "./StoryIndex.module.css";

/** [no, title, credit, type, year, slug, image tail]. The credit is a
 *  number (an index into persons) when it names a profile, otherwise
 *  the plain credit text. */
export type IndexRow = [number, string, string | number, 0 | 1 | 2, number, string, string];

/** [name, slug ("" when it is slugifyName(name)), portrait tail, work count] */
export type IndexPerson = [string, string, string, number];

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
 *
 * A credit that names a profile is its own link, laid over the row's
 * photographer column (links can't nest). Its third cell in the story
 * link stays empty so the positional cell styles still line up.
 */
export function StoryIndexList({
  rows,
  prefix,
  persons,
  portraitPrefix,
}: {
  rows: IndexRow[];
  prefix: string;
  persons: IndexPerson[];
  portraitPrefix: string;
}) {
  return (
    <>
      <ol className={styles.list} id={LIST_ID} aria-label={`${rows.length} stories, newest first`}>
        {rows.map(([no, title, credit, type, year, slug]) => {
          const person = typeof credit === "number" ? persons[credit] : null;
          return (
            <li key={no}>
              {/* Plain <a>: MotionRoot routes in-site clicks already. */}
              <a href={`/${TYPES[type][0]}/${slug}`}>
                <span>{`No. ${no}`}</span>
                <span>{title}</span>
                <span>{person ? null : credit}</span>
                <span>{TYPES[type][1]}</span>
                <span>{year}</span>
              </a>
              {person && (
                <a href={`/photographer/${person[1] || slugifyName(person[0])}`}>
                  {person[0]}
                </a>
              )}
            </li>
          );
        })}
      </ol>
      <IndexThumbs listId={LIST_ID} prefix={prefix} tails={rows.map((r) => r[6])} />
      <IndexPhotographerCard
        listId={LIST_ID}
        persons={persons}
        credits={rows.map((r) => r[2])}
        prefix={portraitPrefix}
      />
    </>
  );
}
