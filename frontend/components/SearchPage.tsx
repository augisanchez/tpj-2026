"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArticleCard } from "./ArticleCard";
import { EmptyState } from "./EmptyState";
import type { ExploreItem } from "@/lib/queries/explore";
import styles from "./SearchPage.module.css";

const LABEL_BY_TYPE: Record<ExploreItem["contentType"], string> = {
  essay: "Photo Essay",
  interview: "Interview",
  feature: "Feature",
};

const DEBOUNCE_MS = 300;

type Props = {
  initialTerm: string;
  results: ExploreItem[];
};

export function SearchPage({ initialTerm, results }: Props) {
  const [term, setTerm] = useState(initialTerm);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const lastPushed = useRef(initialTerm);

  // Autofocus the input on mount so the page is type-ready.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced URL sync: as the user types, push the query string after
  // a short pause. The server re-renders results from the new searchParam.
  useEffect(() => {
    if (term === lastPushed.current) return;
    const id = setTimeout(() => {
      lastPushed.current = term;
      const next = term.trim()
        ? `/search?q=${encodeURIComponent(term.trim())}`
        : "/search";
      startTransition(() => router.replace(next, { scroll: false }));
    }, DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [term, router]);

  const trimmed = term.trim();
  const showResults = trimmed.length > 0;
  const empty = showResults && results.length === 0 && !isPending;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Search</p>
        <div className={styles.inputWrap}>
          <input
            ref={inputRef}
            type="search"
            className={styles.input}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search…"
            aria-label="Search the archive"
            spellCheck={false}
            autoComplete="off"
          />
          <span className={styles.icon} aria-hidden="true">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
        </div>
      </header>

      {showResults && (
        <p className={styles.summary}>
          {isPending
            ? "Searching…"
            : `${results.length} result${results.length === 1 ? "" : "s"} for "${trimmed}"`}
        </p>
      )}

      {empty && (
        <EmptyState
          heading="Nothing in the archive matched that search."
          note="Try a photographer name, a place, or a single word from a title."
        />
      )}

      {showResults && results.length > 0 && (
        <div className={styles.grid}>
          {results.map((item) => (
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
      )}
    </main>
  );
}
