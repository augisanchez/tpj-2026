"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
} from "motion/react";
import { ArticleCard } from "./ArticleCard";
import { EmptyState } from "./EmptyState";
import {
  ExploreFilters,
  type ExploreType,
  type ExploreTheme,
  type ExploreSort,
} from "./ExploreFilters";
import { ExploreFiltersSheet } from "./ExploreFiltersSheet";
import type { ExploreItem } from "@/lib/queries/explore";
import styles from "./ExploreGrid.module.css";

const LABEL_BY_TYPE: Record<ExploreItem["contentType"], string> = {
  essay: "Photo Essay",
  interview: "Interview",
  feature: "Feature",
};

const INITIAL_BATCH = 24;
const LOAD_INCREMENT = 12;
// Bumped from v1 when the filter field was renamed to `theme`. Older
// saved state from v1 is simply ignored on restore.
const STORAGE_KEY = "tpj-explore-state-v2";

/** Seeded shuffle (mulberry32), so a Random view is the same order when
 *  the reader comes back or shares the link. */
function shuffle<T>(arr: T[], seed: number): T[] {
  let a = seed >>> 0 || 1;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

type SavedState = {
  type: ExploreType;
  theme: ExploreTheme;
  sort: ExploreSort;
  visibleCount: number;
  scrollY: number;
};

function readSavedState(): SavedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedState;
  } catch {
    return null;
  }
}

type Props = {
  items: ExploreItem[];
  /** Starting type filter from the URL (?type=essay). Wins over saved state. */
  initialType?: ExploreType;
};

export function ExploreGrid({ items, initialType }: Props) {
  const [type, setType] = useState<ExploreType>(initialType ?? "all");
  const [theme, setTheme] = useState<ExploreTheme>("all");
  const [sort, setSort] = useState<ExploreSort>("newest");
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [visibleCount, setVisibleCount] = useState(INITIAL_BATCH);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const restoredRef = useRef(false);
  // True while restored state is being applied, so the "filters changed,
  // back to the first page" reset doesn't undo the restored page count.
  const restoringRef = useRef(false);

  // Animated count for the result counter. When filters change the
  // displayed number ramps from its previous value to the new one
  // over ~350ms — a quick visual cue that the filter took effect.
  const countMV = useMotionValue(items.length);
  const [displayCount, setDisplayCount] = useState(items.length);

  // ── State persistence: restore on mount ──
  // Render with INITIAL_BATCH on first paint to avoid hydration mismatch,
  // then on mount restore the saved filters/visibleCount/scrollY. Two
  // requestAnimationFrames give React time to render the larger grid
  // before we restore scroll position.
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    // The URL is the source of truth (/explore?type=interview&theme=night
    // &sort=random&seed=42&n=72), read here rather than on the server so
    // the page stays cached. Session storage only adds the scroll spot.
    const q = new URLSearchParams(window.location.search);
    const saved = readSavedState();
    const t = q.get("type");
    const th = q.get("theme");
    const so = q.get("sort");
    const seed = Number(q.get("seed"));
    const n = Number(q.get("n"));
    restoringRef.current = true;
    /* eslint-disable react-hooks/set-state-in-effect -- one-time restore */
    if (t === "essay" || t === "interview" || t === "feature") setType(t);
    if (th) setTheme(th as ExploreTheme);
    if (so === "random" || so === "newest") setSort(so as ExploreSort);
    if (seed > 0) setShuffleSeed(seed);
    if (n > INITIAL_BATCH) setVisibleCount(n);
    /* eslint-enable react-hooks/set-state-in-effect */
    // Restored state has rendered by then; filter changes after this are
    // the reader's and go back to the first page.
    requestAnimationFrame(() => requestAnimationFrame(() => { restoringRef.current = false; }));

    const sameView = saved && window.location.search === (saved as SavedState & { search?: string }).search;
    if (sameView && typeof saved!.scrollY === "number" && saved!.scrollY > 0) {
      // Wait for the restored cards to render (their boxes reserve space)
      // before jumping back to where the reader was.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo({ top: saved!.scrollY, behavior: "instant" as ScrollBehavior });
        });
      });
    }
  }, [initialType]);

  // ── State persistence: save on every state change ──
  // Throttled scroll save runs on a separate listener so we always
  // capture the user's current scrollY when they navigate away.
  useEffect(() => {
    if (!restoredRef.current) return;
    // Mirror the view into the URL without adding history entries, so it
    // can be shared, bookmarked, refreshed, and Back returns to it.
    const q = new URLSearchParams();
    if (type !== "all") q.set("type", type);
    if (theme !== "all") q.set("theme", theme);
    if (sort !== "newest") {
      q.set("sort", sort);
      if (shuffleSeed > 0) q.set("seed", String(shuffleSeed));
    }
    if (visibleCount > INITIAL_BATCH) q.set("n", String(visibleCount));
    const search = q.toString() ? `?${q}` : "";
    if (search !== window.location.search) {
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${search}`);
    }

    const save = () => {
      if (typeof window === "undefined") return;
      try {
        const payload = {
          type,
          theme,
          sort,
          visibleCount,
          scrollY: window.scrollY,
          search,
        };
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch {
        // Storage may be unavailable (private mode, quota); fail silently.
      }
    };

    save();

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      timeoutId = setTimeout(save, 250);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", save);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", save);
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, [type, theme, sort, visibleCount, shuffleSeed]);

  const filtered = useMemo(() => {
    let next = items;
    if (type !== "all") next = next.filter((i) => i.contentType === type);
    if (theme !== "all") next = next.filter((i) => i.themes.includes(theme));
    return next;
  }, [items, type, theme]);

  const ordered = useMemo(() => {
    if (sort === "random") {
      return shuffle(filtered, shuffleSeed || 1);
    }
    return filtered;
  }, [filtered, sort, shuffleSeed]);

  // Reset pagination when the filter/sort criteria change so the user
  // doesn't see a stale slice of the new results. The first run after a
  // restoration shouldn't reset, so we gate on restoredRef.
  useEffect(() => {
    if (!restoredRef.current) return;
    if (restoringRef.current) return;
    setVisibleCount(INITIAL_BATCH);
  }, [type, theme, sort, shuffleSeed]);

  // Animate the result count toward the new filtered total. The
  // motion value drives setDisplayCount via onUpdate so the render
  // tracks integer steps. Tween (not spring) so the ramp is
  // predictable and stops cleanly at the target.
  useEffect(() => {
    const controls = animate(countMV, ordered.length, {
      duration: 0.35,
      ease: [0.2, 0.6, 0.2, 1],
      onUpdate: (v) => setDisplayCount(Math.round(v)),
    });
    return () => controls.stop();
  }, [ordered.length, countMV]);

  // IntersectionObserver-driven infinite scroll. Triggers when the
  // sentinel comes within 400px of the viewport.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    if (visibleCount >= ordered.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((c) => Math.min(c + LOAD_INCREMENT, ordered.length));
        }
      },
      { rootMargin: "400px 0px 400px 0px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [visibleCount, ordered.length]);

  const handleSortChange = (next: ExploreSort) => {
    setSort(next);
    if (next === "random") setShuffleSeed(Math.floor(Math.random() * 1e9) + 1);
  };

  const handleLoadMoreClick = () => {
    setVisibleCount((c) => Math.min(c + LOAD_INCREMENT, ordered.length));
  };

  const visible = ordered.slice(0, visibleCount);
  const hasMore = visibleCount < ordered.length;

  return (
    <>
      <div className={styles.desktopFilters}>
        <ExploreFilters
          type={type}
          theme={theme}
          sort={sort}
          onTypeChange={setType}
          onThemeChange={setTheme}
          onSortChange={handleSortChange}
        />
      </div>
      <div className={styles.mobileFilters}>
        <ExploreFiltersSheet
          type={type}
          theme={theme}
          sort={sort}
          onTypeChange={setType}
          onThemeChange={setTheme}
          onSortChange={handleSortChange}
          resultCount={ordered.length}
        />
      </div>

      <h2 className={styles.count} aria-live="polite">
        {displayCount === items.length
          ? `${items.length} pieces in the archive`
          : `${displayCount} of ${items.length} pieces`}
      </h2>

      {ordered.length === 0 ? (
        <EmptyState heading="Nothing matches those filters yet." />
      ) : (
        <>
          <div className={styles.grid}>
            {/* AnimatePresence + motion.div layout drives FLIP-style
                reflow when filters/sort change. mode="popLayout"
                removes exiting cards from layout flow immediately so
                the remaining cards animate to their new grid
                positions while the exit fade runs in parallel.
                layout="position" instead of plain layout: only
                animate movement, not size — the cards never resize
                between filter states, and animating size on grid
                children risks scrollbar jitter. */}
            <AnimatePresence mode="popLayout" initial={false}>
              {visible.map((item) => (
                <motion.div
                  key={item.id}
                  layout="position"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{
                    layout: { duration: 0.4, ease: [0.2, 0.6, 0.2, 1] },
                    opacity: { duration: 0.25 },
                  }}
                >
                  <ArticleCard
                    variant="4up"
                    article={{
                      title: item.title,
                      date: item.date,
                      href: `/${item.contentType}/${item.slug}`,
                      contentTypeLabel: LABEL_BY_TYPE[item.contentType],
                      featuredImage: item.featuredImage ?? undefined,
                    }}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {hasMore ? (
            <div
              ref={sentinelRef}
              className={styles.sentinel}
              aria-live="polite"
              aria-busy="true"
            >
              <button
                type="button"
                className={styles.sentinelButton}
                onClick={handleLoadMoreClick}
              >
                Load more
              </button>
              <p className={styles.sentinelLabel}>
                {visibleCount} of {ordered.length}
              </p>
            </div>
          ) : (
            <div className={styles.sentinel}>
              <p className={styles.sentinelLabel}>End of archive</p>
            </div>
          )}
        </>
      )}
    </>
  );
}
