"use client";

import { useMemo, useState } from "react";
import { PhotographerListCard } from "./PhotographerListCard";
import type { PhotographerIndexItem } from "@/lib/queries/photographers-index";
import indexStyles from "./PhotographersIndex.module.css";
import styles from "./PhotographersFilters.module.css";

type Props = {
  photographers: PhotographerIndexItem[];
};

/**
 * First *alphabetic* character of the first name, uppercased. Mononyms
 * collapse to their first letter; numeric or punctuation-only leading
 * tokens fall through to "#" so the alphabet remains all letters.
 */
function firstLetter(name: string): string {
  for (const ch of name.trim()) {
    if (/[A-Za-z]/.test(ch)) return ch.toUpperCase();
  }
  return "#";
}

export function PhotographersFilters({ photographers }: Props) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return photographers;
    return photographers.filter((p) => p.name.toLowerCase().includes(term));
  }, [photographers, search]);

  // Group by first-name initial. Letters with no entries in the current
  // (filtered) view are omitted from both the alphabet shortcut and the
  // sectioned grid.
  const grouped = useMemo(() => {
    const map = new Map<string, PhotographerIndexItem[]>();
    for (const p of filtered) {
      const letter = firstLetter(p.name);
      const list = map.get(letter) ?? [];
      list.push(p);
      map.set(letter, list);
    }
    return [...map.entries()].sort(([a], [b]) => {
      if (a === "#") return 1;
      if (b === "#") return -1;
      return a.localeCompare(b);
    });
  }, [filtered]);

  const isFiltering = search.trim().length > 0;
  const totalCount = photographers.length;
  const filteredCount = filtered.length;

  return (
    <>
      <div className={styles.bar}>
        <div className={styles.group}>
          <label className={styles.label} htmlFor="photog-search">
            Search
          </label>
          <input
            id="photog-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search photographers"
            className={styles.input}
            autoComplete="off"
          />
          {isFiltering && (
            <p className={styles.count} aria-live="polite">
              {filteredCount} of {totalCount}
            </p>
          )}
        </div>

        {grouped.length > 0 && (
          <div className={`${styles.group} ${styles.alphabetGroup}`}>
            <p className={styles.label}>Jump to</p>
            <div className={styles.alphabet}>
              {grouped.map(([letter]) => (
                <a
                  key={letter}
                  href={`#letter-${letter}`}
                  className={styles.letterChip}
                >
                  {letter}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {grouped.length === 0 ? (
        <p className={styles.noResults}>
          No photographers match &ldquo;{search.trim()}&rdquo;.
        </p>
      ) : (
        <div className={styles.sections}>
          {grouped.map(([letter, list]) => (
            <section
              key={letter}
              id={`letter-${letter}`}
              className={styles.section}
            >
              <h2 className={styles.letterHeading}>{letter}</h2>
              <div className={indexStyles.grid}>
                {list.map((p) => (
                  <PhotographerListCard
                    key={p.id}
                    name={p.name}
                    slug={p.slug}
                    articleCount={p.articleCount}
                    bio={p.bioPreview}
                    portrait={p.portrait}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
