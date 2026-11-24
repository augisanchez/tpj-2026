"use client";

import { useEffect, useMemo, useState } from "react";
import { PhotographerListCard } from "./PhotographerListCard";
import { PhotographersIndexList } from "./PhotographersIndexList";
import { LazyLetterGrid } from "./LazyLetterGrid";
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

type View = "grid" | "list";

const VIEWS: { value: View; label: string }[] = [
  { value: "grid", label: "Grid" },
  { value: "list", label: "List" },
];

export function PhotographersFilters({ photographers }: Props) {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<View>("grid");

  // The URL holds the view (?view=list), read in the browser like
  // Explore does so the page itself stays static and cached.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("view") === "list") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore
      setView("list");
    }
  }, []);

  const chooseView = (next: View) => {
    setView(next);
    const q = new URLSearchParams(window.location.search);
    if (next === "list") q.set("view", "list");
    else q.delete("view");
    const qs = q.toString() ? `?${q}` : "";
    if (qs !== window.location.search) {
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${qs}${window.location.hash}`,
      );
    }
  };

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

        <div className={styles.group} role="group" aria-label="View">
          <p className={styles.label} aria-hidden="true">
            View
          </p>
          <div className={styles.views}>
            {VIEWS.map((v, i) => (
              <span key={v.value} className={styles.viewItem}>
                {i > 0 && (
                  <span className={styles.viewSep} aria-hidden="true">
                    /
                  </span>
                )}
                <button
                  type="button"
                  className={styles.viewButton}
                  aria-pressed={view === v.value}
                  onClick={() => chooseView(v.value)}
                >
                  {v.label}
                </button>
              </span>
            ))}
          </div>
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
          {grouped.map(([letter, list], i) => (
            <section
              key={letter}
              id={`letter-${letter}`}
              className={styles.section}
            >
              <h2 className={styles.letterHeading}>
                <span className={styles.letterMark}>{letter}</span>
              </h2>
              <LazyLetterGrid
                key={view}
                eager={isFiltering || i < 2}
                people={list}
                variant={view}
              >
                {view === "list" ? (
                  <PhotographersIndexList people={list} />
                ) : (
                  <div className={indexStyles.grid} data-reveal-children>
                    {list.map((p) => (
                      <PhotographerListCard
                        key={p.id}
                        name={p.name}
                        slug={p.slug}
                        articleCount={p.articleCount}
                        appearsInCount={p.appearsInCount}
                        bio={p.bioPreview}
                        portrait={p.portrait}
                      />
                    ))}
                  </div>
                )}
              </LazyLetterGrid>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
