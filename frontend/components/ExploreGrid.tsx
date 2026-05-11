"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArticleCard } from "./ArticleCard";
import { EmptyState } from "./EmptyState";
import {
  ExploreFilters,
  type ExploreType,
  type ExploreTheme,
  type ExploreSort,
} from "./ExploreFilters";
import { ExploreFiltersSheet } from "./ExploreFiltersSheet";
import { THEMES } from "@/lib/themes";
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

/**
 * Placeholder theme assignment until AI tagging runs (Build Plan Step 12).
 * Hashes the article id and maps to one of the 11 themes so the theme
 * filter is functional during the prototype phase. Replace with a real
 * `tpj-theme` taxonomy lookup once tagging exists.
 */
function placeholderThemeSlug(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return THEMES[h % THEMES.length].slug;
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
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
};

export function ExploreGrid({ items }: Props) {
  const [type, setType] = useState<ExploreType>("all");
  const [theme, setTheme] = useState<ExploreTheme>("all");
  const [sort, setSort] = useState<ExploreSort>("newest");
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [visibleCount, setVisibleCount] = useState(INITIAL_BATCH);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const restoredRef = useRef(false);

  // ── State persistence: restore on mount ──
  // Render with INITIAL_BATCH on first paint to avoid hydration mismatch,
  // then on mount restore the saved filters/visibleCount/scrollY. Two
  // requestAnimationFrames give React time to render the larger grid
  // before we restore scroll position.
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    const saved = readSavedState();
    if (!saved) return;

    if (saved.type) setType(saved.type);
    if (saved.theme) setTheme(saved.theme);
    if (saved.sort) setSort(saved.sort);
    if (typeof saved.visibleCount === "number" && saved.visibleCount > INITIAL_BATCH) {
      setVisibleCount(saved.visibleCount);
    }

    if (typeof saved.scrollY === "number" && saved.scrollY > 0) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo({ top: saved.scrollY, behavior: "instant" as ScrollBehavior });
        });
      });
    }
  }, []);

  // ── State persistence: save on every state change ──
  // Throttled scroll save runs on a separate listener so we always
  // capture the user's current scrollY when they navigate away.
  useEffect(() => {
    const save = () => {
      if (typeof window === "undefined") return;
      try {
        const payload: SavedState = {
          type,
          theme,
          sort,
          visibleCount,
          scrollY: window.scrollY,
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
  }, [type, theme, sort, visibleCount]);

  const filtered = useMemo(() => {
    let next = items;
    if (type !== "all") next = next.filter((i) => i.contentType === type);
    if (theme !== "all")
      next = next.filter((i) => placeholderThemeSlug(i.id) === theme);
    return next;
  }, [items, type, theme]);

  const ordered = useMemo(() => {
    if (sort === "random") {
      void shuffleSeed;
      return shuffle(filtered);
    }
    return filtered;
  }, [filtered, sort, shuffleSeed]);

  // Reset pagination when the filter/sort criteria change so the user
  // doesn't see a stale slice of the new results. The first run after a
  // restoration shouldn't reset, so we gate on restoredRef.
  useEffect(() => {
    if (!restoredRef.current) return;
    setVisibleCount(INITIAL_BATCH);
  }, [type, theme, sort, shuffleSeed]);

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
    if (next === "random") setShuffleSeed((s) => s + 1);
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

      {ordered.length === 0 ? (
        <EmptyState heading="Nothing matches those filters yet." />
      ) : (
        <>
          <div className={styles.grid}>
            {visible.map((item) => (
              <ArticleCard
                key={item.id}
                variant="4up"
                article={{
                  title: item.title,
                  date: item.date,
                  href: `/${item.contentType}/${item.slug}`,
                  contentTypeLabel: LABEL_BY_TYPE[item.contentType],
                  featuredImage: item.featuredImage ?? undefined,
                }}
              />
            ))}
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
