"use client";

import { useRef, useState } from "react";
import { ArticleCard } from "./ArticleCard";
import { Icon } from "./Icon";
import { loadSearchIndex } from "./SearchOverlay";
import { TYPE_LABELS } from "@/lib/content-types";
import type { RelatedStory } from "@/lib/queries/related-stories";
import strip from "./RelatedStrip.module.css";
import row from "./RelatedArticles.module.css";
import styles from "./ContinueThread.module.css";

type Props = {
  /** Picked on the server (lib/queries/related-stories.ts buildThread). */
  stories: RelatedStory[];
  /** The story being read, never shuffled in. */
  currentHref: string;
  /** "strip": essays, two large cards a row under a small label.
   *  "row": interviews and features, three cards under a heading. */
  variant: "strip" | "row";
};

const SHUFFLED_LABEL = "Random from the archive";

/**
 * Continue the thread at the end of every story, with a Shuffle button
 * that swaps the cards for random stories from the whole archive. The
 * pool is the quick-search index the search overlay already uses, so a
 * shuffle needs no server round trip after the first (about 50 KB).
 * New cards ripple in through MotionRoot like any other grid.
 */
export function ContinueThread({ stories, currentHref, variant }: Props) {
  const [shown, setShown] = useState(stories);
  const [round, setRound] = useState(0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const sectionRef = useRef<HTMLElement>(null);

  if (stories.length === 0) return null;
  const count = stories.length;
  const shuffled = round > 0;

  const shuffle = async () => {
    setBusy(true);
    try {
      const index = await loadSearchIndex();
      const avoid = new Set([currentHref, ...shown.map((s) => s.href)]);
      const pool = index.stories.filter((s) => s.s && !avoid.has(s.h));
      const picks: RelatedStory[] = [];
      while (picks.length < count && pool.length) {
        const [s] = pool.splice(Math.floor(Math.random() * pool.length), 1);
        picks.push({
          id: s.h,
          title: s.t,
          date: s.d ?? `${s.y ?? 2012}-01-01`,
          href: s.h,
          type: s.k,
          contentTypeLabel: TYPE_LABELS[s.k],
          photographer: s.p,
          featuredImage: { src: s.s!, alt: s.t },
        });
      }
      if (picks.length) {
        setShown(picks);
        setRound((n) => n + 1);
        setStatus(`Showing ${picks.length} random stories.`);
        // Keep the cards in view on phones, where the button sits above them.
        const top = sectionRef.current?.getBoundingClientRect().top ?? 0;
        if (top < 0) sectionRef.current?.scrollIntoView({ block: "start" });
      }
    } catch {
      setStatus("Shuffle isn't available right now.");
    } finally {
      setBusy(false);
    }
  };

  const button = (
    <button
      type="button"
      className={styles.shuffle}
      onClick={shuffle}
      onPointerEnter={() => void loadSearchIndex().catch(() => {})}
      onFocus={() => void loadSearchIndex().catch(() => {})}
      disabled={busy}
      aria-label="Shuffle: show random stories from the archive"
    >
      <Icon name="shuffle" size={16} inline />
      <span>Shuffle</span>
    </button>
  );

  const cards = shown.map((s) => (
    <ArticleCard
      key={s.href}
      variant={variant === "strip" ? "2up" : "5up"}
      article={{
        title: s.title,
        date: s.date,
        href: s.href,
        contentTypeLabel: s.contentTypeLabel,
        photographer: s.photographer,
        featuredImage: s.featuredImage ?? undefined,
      }}
    />
  ));

  return (
    <section ref={sectionRef} className={variant === "strip" ? strip.section : row.section} aria-labelledby="thread-heading">
      {variant === "strip" ? (
        <div className={styles.headRow}>
          <h2 id="thread-heading" className={strip.label} data-reveal>
            {shuffled ? SHUFFLED_LABEL : "Related stories"}
          </h2>
          {button}
        </div>
      ) : (
        <div className={`${styles.headRow} ${styles.headRowWide}`}>
          <div className={row.headerStack}>
            <p className={row.eyebrow}>{shuffled ? SHUFFLED_LABEL : "More from TPJ"}</p>
            <h2 id="thread-heading" className={row.heading}>Continue the thread</h2>
          </div>
          {button}
        </div>
      )}
      <p className={styles.srOnly} aria-live="polite">{status}</p>
      {variant === "strip" ? (
        <ul key={round} className={strip.grid} data-reveal-children>
          {cards.map((card, i) => (
            <li key={shown[i].href} className={strip.item}>{card}</li>
          ))}
        </ul>
      ) : (
        <div key={round} className={row.grid} data-reveal-children>
          {cards}
        </div>
      )}
    </section>
  );
}
