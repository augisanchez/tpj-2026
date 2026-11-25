"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArticleCard } from "./ArticleCard";
import { EmptyState } from "./EmptyState";
import { Icon } from "./Icon";
import { PhotographerListCard } from "./PhotographerListCard";
import type { ExploreItem } from "@/lib/queries/explore";
import type { SearchItem, SearchPhotographer } from "@/lib/queries/search";
import f from "./FilterBar.module.css";
import ih from "./IndexHeader.module.css";
import styles from "./SearchPage.module.css";
import { TYPE_LABELS, countStories } from "@/lib/content-types";

const LABEL_BY_TYPE: Record<ExploreItem["contentType"], string> = TYPE_LABELS;

const DEBOUNCE_MS = 300;

type Props = {
  initialTerm: string;
  results: SearchItem[];
  /** Photographers whose name matches, shown above the articles. */
  photographers?: SearchPhotographer[];
};

export function SearchPage({ initialTerm, results, photographers = [] }: Props) {
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
  const empty =
    showResults && results.length === 0 && photographers.length === 0 && !isPending;
  const counted = [
    photographers.length > 0 &&
      `${photographers.length} ${photographers.length === 1 ? "artist" : "artists"}`,
    countStories(results.length),
  ].filter(Boolean);
  const summary = `${counted.join(" and ")} for \u201c${trimmed}\u201d`;

  return (
    <div className={styles.page}>
      <header className={ih.intro}>
        <h1 className={ih.title} data-reveal="lines">Search</h1>
        <p className={ih.lede} data-reveal>
          Find a story or a photographer.
        </p>
      </header>

      <div className={`${f.bar} ${f.bleed}`}>
        <span className={`${f.fieldWrap} ${f.wide}`}>
          <input
            ref={inputRef}
            type="search"
            className={`${f.control} ${f.field}`}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search the archive"
            aria-label="Search the archive"
            spellCheck={false}
            autoComplete="off"
          />
          <Icon name="search" size={16} className={f.fieldIcon} />
        </span>
      </div>

      <p className={f.count} aria-live="polite">
        {!showResults ? "" : isPending ? "Searching…" : summary}
      </p>

      {empty && (
        <EmptyState
          heading="Nothing in the archive by that name. Yet."
          note="Try an artist’s name, a place, or a single word from a title."
        />
      )}

      {showResults && photographers.length > 0 && (
        <div className={styles.people}>
          {photographers.map((p) => (
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
                photographer: item.photographer,
                featuredImage: item.featuredImage ?? undefined,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
