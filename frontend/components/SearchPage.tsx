"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Icon } from "./Icon";
import { loadSearchIndex, peekSearchIndex } from "./SearchOverlay";
import type { SearchItem, SearchPhotographer } from "@/lib/queries/search";
import { fold, highlight, quickSearch, type IndexStory, type PreparedIndex } from "@/lib/search-index";
import { THEMES } from "@/lib/themes";
import { cdnImageUrl } from "@/lib/cdn";
import { decodeHtmlEntities } from "@/lib/text-utils";
import { TYPE_LABELS } from "@/lib/content-types";
import so from "./SearchOverlay.module.css";
import styles from "./SearchPage.module.css";

/**
 * The search results page (/search?q=…). A real page in history: open a
 * result, press Back, and the same results come back where you left
 * them (the URL holds the query; the index is cached in memory).
 *
 * Two kinds of match, in two sections so nothing jumps as results land:
 *  - Titles and names: matched in the browser from the quick-search
 *    index (lib/search-index.ts), so they follow every keystroke.
 *  - Mentioned in: WordPress full-text matches (words inside a story),
 *    fetched by the server after a short pause in typing, minus
 *    anything already listed above.
 */

const DEBOUNCE_MS = 300;

type Props = {
  /** The query the server results below were fetched for. */
  initialTerm: string;
  results: SearchItem[];
  photographers?: SearchPhotographer[];
};

type Row = {
  href: string;
  title: string;
  type: IndexStory["k"];
  photographer: string | null;
  year: number | null;
  thumb: string | null;
};

const fromIndex = (s: IndexStory): Row => ({
  href: s.h,
  title: s.t,
  type: s.k,
  photographer: s.p,
  year: s.y,
  thumb: s.i,
});

const fromServer = (s: SearchItem): Row => ({
  href: `/${s.contentType}/${s.slug}`,
  title: decodeHtmlEntities(s.title).trim(),
  type: s.contentType,
  photographer: s.photographer ? decodeHtmlEntities(s.photographer).trim() : null,
  year: s.date ? Number(s.date.slice(0, 4)) || null : null,
  thumb: s.featuredImage ? cdnImageUrl(s.featuredImage.src, { width: 320 }) : null,
});

function Marked({ text, query }: { text: string; query: string }) {
  const parts = highlight(text, query);
  if (!parts) return <>{text}</>;
  return (
    <>
      {parts[0]}
      <mark className={so.mark}>{parts[1]}</mark>
      {parts[2]}
    </>
  );
}

function StoryRow({ row, query }: { row: Row; query: string }) {
  const meta = [TYPE_LABELS[row.type], row.photographer && row.photographer !== row.title ? row.photographer : null, row.year]
    .filter(Boolean);
  return (
    <li>
      <Link href={row.href} className={`${so.story} ${styles.row}`}>
        <span className={`${so.thumb} ${styles.thumb}`} aria-hidden="true">
          {row.thumb && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={row.thumb} alt="" loading="lazy" decoding="async" />
          )}
        </span>
        <span className={so.text}>
          <span className={`${so.title} ${styles.title}`}>
            <Marked text={row.title} query={query} />
          </span>
          <span className={so.meta}>
            {meta.map((part, i) => (
              <Fragment key={i}>
                {i > 0 && <span aria-hidden="true"> · </span>}
                {part}
              </Fragment>
            ))}
          </span>
        </span>
      </Link>
    </li>
  );
}

export function SearchPage({ initialTerm, results, photographers = [] }: Props) {
  const router = useRouter();
  const [term, setTerm] = useState(initialTerm);
  const [index, setIndex] = useState<PreparedIndex | null>(() => peekSearchIndex());
  const [indexFailed, setIndexFailed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const lastPushed = useRef(initialTerm);

  useEffect(() => {
    if (index) return;
    loadSearchIndex().then(setIndex).catch(() => setIndexFailed(true));
  }, [index]);

  // Ready to type on a fresh visit. Not when returning with a query:
  // on phones that would throw the keyboard over the results.
  useEffect(() => {
    if (!initialTerm) inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the URL on the query (replace, not push: one history entry per
  // search, not per keystroke). The server then fetches full-text matches.
  const pushTerm = (value: string) => {
    const next = value.trim();
    if (next === lastPushed.current) return;
    lastPushed.current = next;
    const url = next ? `/search?q=${encodeURIComponent(next)}` : "/search";
    startTransition(() => router.replace(url, { scroll: false }));
  };
  useEffect(() => {
    const id = setTimeout(() => pushTerm(term), DEBOUNCE_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  const trimmed = term.trim();
  const serverFresh = fold(initialTerm) === fold(trimmed) && !isPending;

  const quick = useMemo(
    () => (index && trimmed ? quickSearch(index, trimmed, { artists: 12, stories: 60, themes: 4 }) : null),
    [index, trimmed],
  );

  // Titles and names: the index, or the server's list if the index
  // couldn't load.
  const named: Row[] = quick
    ? quick.stories.map(fromIndex)
    : indexFailed && serverFresh
      ? results.map(fromServer)
      : [];
  const namedHrefs = new Set(named.map((r) => r.href));
  const mentioned: Row[] =
    quick && serverFresh ? results.map(fromServer).filter((r) => !namedHrefs.has(r.href)) : [];
  const artists = quick
    ? quick.artists.map((a) => ({ href: a.h, name: a.n, count: a.c, portrait: a.i }))
    : serverFresh
      ? photographers.map((p) => ({
          href: `/artist/${p.slug}`,
          name: p.name,
          count: p.articleCount,
          portrait: p.portrait ? cdnImageUrl(p.portrait.src, { width: 160 }) : null,
        }))
      : [];
  const themes = quick?.themes ?? [];

  const waitingForText = Boolean(trimmed) && !serverFresh;
  const nothing =
    Boolean(trimmed) && serverFresh && (index || indexFailed) &&
    !artists.length && !named.length && !mentioned.length && !themes.length;

  const summary = [
    artists.length > 0 && `${artists.length} ${artists.length === 1 ? "artist" : "artists"}`,
    named.length > 0 && `${named.length} ${named.length === 1 ? "story" : "stories"}`,
    mentioned.length > 0 && `${mentioned.length} more ${mentioned.length === 1 ? "mentions" : "mention"} it`,
  ].filter(Boolean).join(" · ");

  return (
    <div className={styles.page}>
      <h1 className={so.srOnly}>{trimmed ? `Search results for ${trimmed}` : "Search"}</h1>

      <form
        role="search"
        className={`${so.bar} ${styles.bar}`}
        onSubmit={(e) => {
          e.preventDefault();
          pushTerm(term);
          inputRef.current?.blur(); // phones: put the keyboard away
        }}
      >
        <Icon name="search" size={40} className={so.glass} />
        <input
          ref={inputRef}
          type="search"
          enterKeyHint="search"
          className={`${so.input} ${styles.input}`}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search TPJ"
          aria-label="Search stories, artists and themes"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-search-page-input
        />
        {term && (
          <button
            type="button"
            className={so.clear}
            onClick={() => {
              setTerm("");
              inputRef.current?.focus();
            }}
          >
            Clear
          </button>
        )}
      </form>

      <p className={styles.summary} aria-live="polite">
        {!trimmed ? "Stories, artists and themes from the whole archive." : summary || (waitingForText ? "Searching…" : "")}
      </p>

      {!trimmed && (
        <section className={so.section} aria-labelledby="sp-themes">
          <h2 id="sp-themes" className={so.heading}>Browse by theme</h2>
          <div className={so.chips}>
            {THEMES.map((t) => (
              <Link key={t.slug} href={`/theme/${t.slug}`} className={so.chip}>
                {t.name}
              </Link>
            ))}
            <Link href="/random" prefetch={false} className={`${so.chip} ${so.chipQuiet}`}>
              <Icon name="shuffle" size={14} inline /> Random story
            </Link>
          </div>
        </section>
      )}

      {artists.length > 0 && (
        <section className={so.section} aria-labelledby="sp-artists">
          <h2 id="sp-artists" className={so.heading}>Artists</h2>
          <ul className={`${styles.list} ${styles.artists}`}>
            {artists.map((a) => (
              <li key={a.href}>
                <Link href={a.href} className={so.artist}>
                  <span className={`${so.avatar} ${styles.avatar}`} aria-hidden="true">
                    {a.portrait ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.portrait} alt="" loading="lazy" decoding="async" />
                    ) : (
                      a.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("")
                    )}
                  </span>
                  <span className={so.text}>
                    <span className={so.name}><Marked text={a.name} query={trimmed} /></span>
                    {a.count > 0 && (
                      <span className={so.meta}>{a.count} {a.count === 1 ? "story" : "stories"}</span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {themes.length > 0 && (
        <section className={so.section} aria-labelledby="sp-matched-themes">
          <h2 id="sp-matched-themes" className={so.heading}>Themes</h2>
          <div className={so.chips}>
            {themes.map((t) => (
              <Link key={t.h} href={t.h} className={so.chip}>
                <Marked text={t.n} query={trimmed} />
              </Link>
            ))}
          </div>
        </section>
      )}

      {named.length > 0 && (
        <section className={so.section} aria-labelledby="sp-stories">
          <h2 id="sp-stories" className={so.heading}>Stories</h2>
          <ul className={`${styles.list} ${styles.stories}`}>
            {named.map((row) => (
              <StoryRow key={row.href} row={row} query={trimmed} />
            ))}
          </ul>
        </section>
      )}

      {trimmed && (mentioned.length > 0 || waitingForText) && (
        <section className={so.section} aria-labelledby="sp-mentioned" aria-busy={waitingForText}>
          <h2 id="sp-mentioned" className={so.heading}>Mentioned in</h2>
          {waitingForText ? (
            <p className={styles.reading}>Reading inside the stories…</p>
          ) : (
            <ul className={`${styles.list} ${styles.stories}`}>
              {mentioned.map((row) => (
                <StoryRow key={row.href} row={row} query={trimmed} />
              ))}
            </ul>
          )}
        </section>
      )}

      {nothing && (
        <div className={styles.nothing}>
          <p className={styles.nothingLine}>Nothing in the archive by that name. Yet.</p>
          <p className={so.meta}>Try an artist’s name, a place, or a single word from a title.</p>
        </div>
      )}
    </div>
  );
}
