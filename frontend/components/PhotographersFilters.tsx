"use client";

import { useEffect, useMemo, useState } from "react";
import { PhotographerListCard } from "./PhotographerListCard";
import { PhotographersIndexList } from "./PhotographersIndexList";
import { LazyLetterGrid } from "./LazyLetterGrid";
import { Icon } from "./Icon";
import { ViewToggle, type View } from "./ViewToggle";
import { Chevron } from "./ExploreFilters";
import type { ArtistRole, PhotographerIndexItem } from "@/lib/queries/photographers-index";
import indexStyles from "./PhotographersIndex.module.css";
import f from "./FilterBar.module.css";
import styles from "./PhotographersFilters.module.css";

type Props = {
  photographers: PhotographerIndexItem[];
};

type RoleFilter = "all" | ArtistRole;

/** Plural labels for the role filter. Models are not a role here. */
const ROLE_LABELS: Record<ArtistRole, string> = {
  photographer: "Photographers",
  interviewed: "Interviewed",
  interviewer: "Interviewers",
  writer: "Writers",
};
const ROLES = Object.keys(ROLE_LABELS) as ArtistRole[];

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

/**
 * Jump to a letter section and hold it there while the lazy sections
 * around it fill in (they would otherwise push the target off screen).
 */
function jumpToLetter(letter: string) {
  const el = document.getElementById(`letter-${letter}`);
  if (!el) return;
  history.replaceState(history.state, "", `#letter-${letter}`);
  const align = () => el.scrollIntoView({ block: "start" });
  align();
  [80, 200, 400, 700, 1100].forEach((ms) => window.setTimeout(align, ms));
}

export function PhotographersFilters({ photographers }: Props) {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<View>("grid");
  const [role, setRole] = useState<RoleFilter>("all");

  // The URL holds the view (?view=list) and role (?role=writer), read
  // in the browser like Explore does so the page stays static and cached.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("view") === "list") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore
      setView("list");
    }
    const r = q.get("role") as ArtistRole | null;
    if (r && r in ROLE_LABELS) setRole(r);
  }, []);

  const writeQuery = (key: string, value: string | null) => {
    const q = new URLSearchParams(window.location.search);
    if (value) q.set(key, value);
    else q.delete(key);
    const qs = q.toString() ? `?${q}` : "";
    if (qs !== window.location.search) {
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${qs}${window.location.hash}`,
      );
    }
  };

  const chooseView = (next: View) => {
    setView(next);
    writeQuery("view", next === "list" ? "list" : null);
  };

  const chooseRole = (next: RoleFilter) => {
    setRole(next);
    writeQuery("role", next === "all" ? null : next);
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return photographers.filter(
      (p) =>
        (role === "all" || (p.roles ?? []).includes(role)) &&
        (!term || p.name.toLowerCase().includes(term)),
    );
  }, [photographers, search, role]);

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

  const isFiltering = search.trim().length > 0 || role !== "all";
  const totalCount = photographers.length;
  const filteredCount = filtered.length;

  return (
    <>
      <div className={f.bar}>
        <div className={`${f.group} ${styles.searchGroup}`}>
          <label className={`${f.label} ${styles.searchLabel}`} htmlFor="photog-search">
            Search
          </label>
          <span className={f.fieldWrap}>
            <input
              id="photog-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search artists"
              className={`${f.control} ${f.field}`}
              autoComplete="off"
            />
            <Icon name="search" size={16} className={f.fieldIcon} />
          </span>
        </div>

        <div className={`${f.group} ${styles.roleGroup}`}>
          <p className={f.label} aria-hidden="true">Role</p>
          <div className={`${f.segmented} ${styles.roleScroll}`} role="group" aria-label="Role">
            <button
              type="button"
              className={f.control}
              onClick={() => chooseRole("all")}
              aria-pressed={role === "all"}
            >
              All
            </button>
            {ROLES.map((id) => (
              <button
                key={id}
                type="button"
                className={f.control}
                onClick={() => chooseRole(id)}
                aria-pressed={role === id}
              >
                {ROLE_LABELS[id]}
              </button>
            ))}
          </div>
        </div>

        {/* Phones: the A to Z row is hidden, so a letter menu jumps
            instead. Native select: the phone's own picker. */}
        {grouped.length > 0 && (
          <div className={`${f.group} ${styles.letterMenu}`}>
            <label className={f.label} htmlFor="artist-letter">Jump to letter</label>
            <span className={f.selectWrap}>
              <select
                id="artist-letter"
                className={`${f.control} ${f.select} ${styles.letterSelect}`}
                value=""
                onChange={(e) => {
                  if (e.target.value) jumpToLetter(e.target.value);
                }}
              >
                <option value="" disabled>A–Z</option>
                {grouped.map(([letter]) => (
                  <option key={letter} value={letter}>{letter}</option>
                ))}
              </select>
              <Chevron />
            </span>
          </div>
        )}

        {/* Grid / List sits at the right edge, like Explore's. */}
        <div className={`${f.end} ${styles.viewGroup}`}>
          <ViewToggle view={view} onChange={chooseView} />
        </div>

        {grouped.length > 0 && (
          <div className={`${f.group} ${styles.alphabetGroup}`}>
            <p className={f.label}>Jump to</p>
            <div className={styles.alphabet}>
              {grouped.map(([letter]) => (
                <a
                  key={letter}
                  href={`#letter-${letter}`}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                    e.preventDefault();
                    jumpToLetter(letter);
                  }}
                  className={`${f.control} ${styles.letter}`}
                >
                  {letter}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      <p className={`${f.count} ${styles.count}`} aria-live="polite">
        {isFiltering
          ? `${filteredCount} of ${totalCount} artists`
          : `${totalCount} ${totalCount === 1 ? "artist" : "artists"}`}
      </p>

      {grouped.length === 0 ? (
        <p className={styles.noResults}>
          {search.trim()
            ? <>No artists match &ldquo;{search.trim()}&rdquo;{role !== "all" ? ` among ${ROLE_LABELS[role].toLowerCase()}` : ""}.</>
            : <>No {ROLE_LABELS[role as ArtistRole]?.toLowerCase()} yet.</>}
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
              {/* Keyed by view and role: switching either remounts the
                  cards, so MotionRoot replays the diagonal wave (same as
                  the homepage theme switcher). Search stays instant. */}
              <LazyLetterGrid
                key={`${view}:${role}`}
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
                        counts={p.counts}
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
