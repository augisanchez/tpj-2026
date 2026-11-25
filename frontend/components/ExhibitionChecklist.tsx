"use client";

import type { MouseEvent } from "react";
import type { Plate } from "@/lib/exhibition";
import { Icon } from "./Icon";
import styles from "./ExhibitionChecklist.module.css";

type Props = {
  plates: Plate[];
};

/**
 * End-of-article "Photographs": every photograph in the piece, numbered. Each thumbnail links to its anchor in the body (plain hash links
 * work without JavaScript); with JavaScript the photo is centred on screen
 * and focused. Every thumbnail shows: they wrap into rows, nothing
 * scrolls or hides. Hovering a thumbnail shows an up arrow: it jumps to
 * that photograph in the body.
 */
export function ExhibitionChecklist({ plates }: Props) {
  if (plates.length === 0) return null;

  const onClick = (e: MouseEvent<HTMLOListElement>) => {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const link = (e.target as HTMLElement).closest<HTMLAnchorElement>("a[href^='#plate-']");
    if (!link) return;
    const target = document.getElementById(link.hash.slice(1));
    if (!target) return;
    e.preventDefault();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    target.focus({ preventScroll: true });
    history.replaceState(null, "", link.hash);
  };

  return (
    <section className={styles.section} aria-labelledby="checklist-heading" data-checklist>
      <div className={styles.head} data-reveal>
        <h2 id="checklist-heading" className={styles.label}>Photographs</h2>
      </div>
      <ol className={styles.strip} data-reveal-children onClick={onClick}>
        {plates.map((p) => {
          const ratio = p.width && p.height ? Math.min(2, Math.max(0.6, p.width / p.height)) : 1.333;
          return (
            <li key={p.id} className={styles.item} style={{ ["--r" as string]: ratio }}>
              <a href={`#${p.id}`} className={styles.link} aria-label={`Photograph ${p.n} of ${plates.length}${p.alt ? `: ${p.alt}` : ""}. Go to photograph`}>
                <span className={styles.frame}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- body URLs are already CDN renditions */}
                  <img src={p.src} alt="" loading="lazy" decoding="async" data-fade className={styles.img} />
                  {/* Shown on hover and focus: this jumps up to the photo. */}
                  <span className={styles.jump} aria-hidden="true">
                    <Icon name="arrowUp" size={14} />
                  </span>
                </span>
                <span className={styles.caption} aria-hidden="true">{p.n}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
