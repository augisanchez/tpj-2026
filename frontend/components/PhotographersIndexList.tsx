"use client";

import Link from "next/link";
import { cdnImageUrl } from "@/lib/cdn";
import type { PhotographerIndexItem } from "@/lib/queries/photographers-index";
import styles from "./PhotographersIndexList.module.css";
import { countStories } from "@/lib/content-types";

/**
 * List view of the photographers index (Stedelijk-style): one full-width
 * row per person, the name set large in condensed caps and the work
 * count at the right edge. On hover or keyboard focus (fine pointers)
 * the row fills with the house colour and a small portrait shows in a
 * slot that is always reserved, so nothing moves. Phones get no slot
 * and no portrait download.
 */
export function PhotographersIndexList({ people }: { people: PhotographerIndexItem[] }) {
  return (
    <ul className={styles.list} data-reveal-children>
      {people.map((p) => {
        const thumb = p.portrait ? cdnImageUrl(p.portrait.src, { width: 160, quality: 80 }) : null;
        return (
          <li key={p.id}>
            <Link href={`/artist/${p.slug}`} prefetch={false} className={styles.row}>
              <span className={styles.name}>{p.name}</span>
              <span className={styles.slot} aria-hidden="true">
                {thumb && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb} alt="" loading="lazy" decoding="async" />
                )}
              </span>
              <span className={styles.count}>
                {(() => {
                  const n = p.counts
                    ? p.counts.essays + p.counts.features + p.counts.interviews + p.counts.conducted + p.counts.written
                    : p.articleCount;
                  return countStories(n);
                })()}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
