"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./Icon";
import {
  highlight,
  prepareIndex,
  quickSearch,
  type PreparedIndex,
  type SearchIndex,
} from "@/lib/search-index";
import { TYPE_LABELS } from "@/lib/content-types";
import styles from "./SearchOverlay.module.css";

/**
 * Search from anywhere. Opens over the current page from the nav search
 * icon (any link marked data-open-search), ⌘K / Ctrl+K, or "/". Results
 * come from a small index loaded once (lib/search-index.ts), so they
 * change on every keystroke with no server round trip. "See all
 * results" hands off to /search for full-text matches.
 *
 * Accessibility: a modal dialog (Radix: focus trap, Esc, scroll lock,
 * focus returns to the trigger) holding a combobox. Arrow keys move
 * through the results; Enter opens the highlighted one, or with nothing
 * highlighted, the full results page (/search?q=…), a real page that
 * Back returns to.
 */

const OPEN_EVENT = "tpj:open-search";
const PAGE_INPUT = "[data-search-page-input]";

/** Opens the overlay from anywhere in the app. */
export function openSearch() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

let indexPromise: Promise<PreparedIndex> | null = null;
let loadedIndex: PreparedIndex | null = null;

/** The index if it has already loaded, so a page coming back from
 *  history renders its results in the first paint (scroll restores). */
export function peekSearchIndex(): PreparedIndex | null {
  return loadedIndex;
}

/** Loads (once) and prepares the index. Called on intent (hover/focus
 *  of a search trigger) so it's usually ready before the first key. */
export function loadSearchIndex(): Promise<PreparedIndex> {
  if (!indexPromise) {
    indexPromise = fetch("/api/search-index")
      .then((r) => {
        if (!r.ok) throw new Error(`search index ${r.status}`);
        return r.json() as Promise<SearchIndex>;
      })
      .then((raw) => (loadedIndex = prepareIndex(raw)))
      .catch((e) => {
        indexPromise = null; // try again next time
        throw e;
      });
  }
  return indexPromise;
}

function isEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
}

type Option = { id: string; href: string };

function Marked({ text, query }: { text: string; query: string }) {
  const parts = highlight(text, query);
  if (!parts) return <>{text}</>;
  return (
    <>
      {parts[0]}
      <mark className={styles.mark}>{parts[1]}</mark>
      {parts[2]}
    </>
  );
}

export function SearchOverlay() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState<PreparedIndex | null>(() => peekSearchIndex());
  const [failed, setFailed] = useState(false);
  // -1: nothing highlighted, so Enter goes to the results page.
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // On /search the page's own field is already in front: focus it.
  const reach = useCallback(() => {
    if (window.location.pathname === "/search") {
      const field = document.querySelector<HTMLInputElement>(PAGE_INPUT);
      if (field) {
        field.focus();
        field.select();
        return;
      }
    }
    setOpen(true);
  }, []);

  // Triggers: the open event, keyboard shortcuts, data-open-search links.
  useEffect(() => {
    const onEvent = () => reach();
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) setOpen(false);
        else reach();
        return;
      }
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && !isEditable(e.target)) {
        e.preventDefault();
        reach();
      }
    };
    // Capture on window runs before MotionRoot's page-transition handler
    // (document, capture), so a search link opens the overlay instead of
    // navigating. Modified clicks still open /search in a new tab.
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const trigger = (e.target as HTMLElement | null)?.closest?.("[data-open-search]");
      if (!trigger) return;
      e.preventDefault();
      e.stopPropagation();
      reach();
    };
    const onIntent = (e: Event) => {
      if ((e.target as HTMLElement | null)?.closest?.("[data-open-search]")) {
        loadSearchIndex().catch(() => {});
      }
    };
    window.addEventListener(OPEN_EVENT, onEvent);
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick, true);
    window.addEventListener("pointerover", onIntent, { passive: true });
    window.addEventListener("focusin", onIntent);
    window.addEventListener("touchstart", onIntent, { passive: true });
    return () => {
      window.removeEventListener(OPEN_EVENT, onEvent);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("pointerover", onIntent);
      window.removeEventListener("focusin", onIntent);
      window.removeEventListener("touchstart", onIntent);
    };
  }, [open, reach]);

  // Load the index when opened (instant if the intent prefetch ran).
  useEffect(() => {
    if (!open || index) return;
    let live = true;
    loadSearchIndex()
      .then((ix) => {
        if (!live) return;
        setIndex(ix);
        setFailed(false);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [open, index]);

  // Close when the page changes underneath (a result was opened).
  // Adjusted during render, React's pattern for state that follows a prop.
  const [shownPath, setShownPath] = useState(pathname);
  if (shownPath !== pathname) {
    setShownPath(pathname);
    setOpen(false);
  }

  const trimmed = query.trim();
  const results = useMemo(
    () => (index && trimmed ? quickSearch(index, trimmed) : null),
    [index, trimmed],
  );
  const themes = useMemo(() => index?.themes ?? [], [index]);

  // Every selectable row, in on-screen order, for the arrow keys.
  const options: Option[] = useMemo(() => {
    const list: Option[] = [];
    if (!trimmed) {
      themes.forEach((t) => list.push({ id: `so-theme-${t.h}`, href: t.h }));
      list.push({ id: "so-random", href: "/random" });
      return list;
    }
    results?.artists.forEach((a) => list.push({ id: `so-a-${a.h}`, href: a.h }));
    results?.stories.forEach((s) => list.push({ id: `so-s-${s.h}`, href: s.h }));
    results?.themes.forEach((t) => list.push({ id: `so-t-${t.h}`, href: t.h }));
    list.push({ id: "so-all", href: `/search?q=${encodeURIComponent(trimmed)}` });
    return list;
  }, [trimmed, results, themes]);

  // Warm the highlighted result so Enter lands fast; keep it in view.
  const activeOption = active >= 0 ? options[active] : undefined;
  useEffect(() => {
    if (!open || !activeOption) return;
    if (activeOption.href !== "/random") router.prefetch(activeOption.href);
    document.getElementById(activeOption.id)?.scrollIntoView({ block: "nearest" });
  }, [open, activeOption, router]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!options.length) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) =>
        i < 0 ? (step > 0 ? 0 : options.length - 1) : (i + step + options.length) % options.length,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      // A real click, so the page transition runs as for any link.
      // Nothing highlighted: the results page ("See all results").
      const id = activeOption?.id ?? (trimmed ? "so-all" : null);
      if (id) document.getElementById(id)?.click();
    }
  };

  const optionProps = (id: string) => {
    const i = options.findIndex((o) => o.id === id);
    return {
      id,
      role: "option" as const,
      "aria-selected": i === active,
      prefetch: false,
      onMouseMove: () => i !== active && setActive(i),
      onClick: () => setOpen(false),
    };
  };

  const empty =
    results && !results.artists.length && !results.stories.length && !results.themes.length;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setActive(-1);
      }}
    >
      <Dialog.Portal>
        <Dialog.Content
          className={styles.panel}
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
            inputRef.current?.select();
          }}
        >
          <Dialog.Title className={styles.srOnly}>Search</Dialog.Title>
          <div className={styles.inner}>
            <div className={styles.bar}>
              <Icon name="search" size={40} className={styles.glass} />
              <input
                ref={inputRef}
                type="text"
                inputMode="search"
                enterKeyHint="go"
                className={styles.input}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(-1); // new results: nothing highlighted
                }}
                onKeyDown={onKeyDown}
                placeholder="Search TPJ"
                aria-label="Search stories, artists and themes"
                role="combobox"
                aria-expanded={options.length > 0}
                aria-controls="search-overlay-results"
                aria-activedescendant={activeOption?.id}
                aria-autocomplete="list"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
              {query && (
                <button
                  type="button"
                  className={styles.clear}
                  onClick={() => {
                    setQuery("");
                    setActive(-1);
                    inputRef.current?.focus();
                  }}
                >
                  Clear
                </button>
              )}
              <Dialog.Close className={styles.close} aria-label="Close search">
                <kbd className={styles.kbd}>Esc</kbd>
                <Icon name="close" size={24} />
              </Dialog.Close>
            </div>

            <div
              ref={listRef}
              id="search-overlay-results"
              role="listbox"
              aria-label={trimmed ? `Results for ${trimmed}` : "Browse"}
              className={styles.results}
            >
              {!trimmed && (
                <section className={styles.section} role="group" aria-labelledby="so-h-themes">
                  <h2 id="so-h-themes" className={styles.heading}>Browse by theme</h2>
                  <div className={styles.chips}>
                    {themes.map((t) => (
                      <Link key={t.h} href={t.h} className={styles.chip} {...optionProps(`so-theme-${t.h}`)}>
                        {t.n}
                      </Link>
                    ))}
                    <Link href="/random" className={`${styles.chip} ${styles.chipQuiet}`} {...optionProps("so-random")}>
                      <Icon name="shuffle" size={14} inline /> Random story
                    </Link>
                  </div>
                </section>
              )}

              {trimmed && !index && !failed && <p className={styles.status}>Opening the archive…</p>}
              {trimmed && failed && (
                <p className={styles.status}>Quick results didn’t load. Full search still works below.</p>
              )}

              {results && results.artists.length > 0 && (
                <section className={styles.section} role="group" aria-labelledby="so-h-artists">
                  <h2 id="so-h-artists" className={styles.heading}>Artists</h2>
                  <div className={styles.artists}>
                    {results.artists.map((a) => (
                      <Link key={a.h} href={a.h} className={styles.artist} {...optionProps(`so-a-${a.h}`)}>
                        <span className={styles.avatar} aria-hidden="true">
                          {a.i ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={a.i} alt="" loading="eager" decoding="async" />
                          ) : (
                            a.n.split(/\s+/).map((w) => w[0]).slice(0, 2).join("")
                          )}
                        </span>
                        <span className={styles.text}>
                          <span className={styles.name}><Marked text={a.n} query={trimmed} /></span>
                          {a.c > 0 && (
                            <span className={styles.meta}>
                              {a.c} {a.c === 1 ? "story" : "stories"}
                            </span>
                          )}
                        </span>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {results && results.stories.length > 0 && (
                <section className={styles.section} role="group" aria-labelledby="so-h-stories">
                  <h2 id="so-h-stories" className={styles.heading}>Stories</h2>
                  <div className={styles.stories}>
                    {results.stories.map((s) => (
                      <Link key={s.h} href={s.h} className={styles.story} {...optionProps(`so-s-${s.h}`)}>
                        <span className={styles.thumb} aria-hidden="true">
                          {s.i && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={s.i} alt="" loading="eager" decoding="async" />
                          )}
                        </span>
                        <span className={styles.text}>
                          <span className={styles.title}><Marked text={s.t} query={trimmed} /></span>
                          <span className={styles.meta}>
                            {[TYPE_LABELS[s.k], s.p && s.p !== s.t ? s.p : null, s.y].filter(Boolean).map((part, i) => (
                              <Fragment key={i}>
                                {i > 0 && <span aria-hidden="true"> · </span>}
                                {part}
                              </Fragment>
                            ))}
                          </span>
                        </span>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {results && results.themes.length > 0 && (
                <section className={styles.section} role="group" aria-labelledby="so-h-matched-themes">
                  <h2 id="so-h-matched-themes" className={styles.heading}>Themes</h2>
                  <div className={styles.chips}>
                    {results.themes.map((t) => (
                      <Link key={t.h} href={t.h} className={styles.chip} {...optionProps(`so-t-${t.h}`)}>
                        <Marked text={t.n} query={trimmed} />
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {trimmed && (
                <section className={styles.section}>
                  {empty && (
                    <p className={styles.status}>No titles or names match. The full search also reads inside stories.</p>
                  )}
                  <Link
                    href={`/search?q=${encodeURIComponent(trimmed)}`}
                    className={styles.all}
                    {...optionProps("so-all")}
                  >
                    See all results for “{trimmed}” <span aria-hidden="true">→</span>
                  </Link>
                </section>
              )}
            </div>

            <p className={styles.hints} aria-hidden="true">
              <span><kbd className={styles.kbd}>Enter</kbd> all results</span>
              <span><kbd className={styles.kbd}>↑</kbd><kbd className={styles.kbd}>↓</kbd> pick one</span>
              <span><kbd className={styles.kbd}>Esc</kbd> close</span>
              <span><kbd className={styles.kbd}>⌘K</kbd> search from any page</span>
            </p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
