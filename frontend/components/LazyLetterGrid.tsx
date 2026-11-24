"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./PhotographersIndex.module.css";

type Props = {
  /** Render straight away (first letters, or while searching). */
  eager: boolean;
  people: { id: string; name: string; slug: string }[];
  /** Which layout the placeholder should approximate. */
  variant?: "grid" | "list";
  children: ReactNode;
};

/**
 * The Photographers page lists ~500 people. Rendering every card up
 * front cost ~870 KB of HTML and ~3,800 DOM nodes. Letters further down
 * render when they come within a couple of screens of the viewport.
 * Until then the section holds roughly its final height (so the A–Z
 * jumps and scrollbar stay honest) and a plain list of links, so every
 * profile is still one link away for crawlers and screen readers.
 */
export function LazyLetterGrid({ eager, people, variant = "grid", children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(eager);

  useEffect(() => {
    if (shown) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setShown(true);
      },
      { rootMargin: "1600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);

  if (eager || shown) return <>{children}</>;
  return (
    <div
      ref={ref}
      className={`${styles.gridPlaceholder}${variant === "list" ? " " + styles.listPlaceholder : ""}`}
      style={{ ["--n" as string]: people.length }}
    >
      <ul className={styles.srList}>
        {people.map((p) => (
          <li key={p.id}>
            <Link href={`/photographer/${p.slug}`} prefetch={false}>
              {p.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
