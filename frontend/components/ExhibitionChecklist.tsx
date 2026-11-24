"use client";

import type { MouseEvent } from "react";
import type { Plate } from "@/lib/exhibition";
import styles from "./ExhibitionChecklist.module.css";

type Props = {
  plates: Plate[];
};

/**
 * End-of-article checklist: every photograph in the piece as a numbered
 * plate. Each thumbnail links to its anchor in the body (plain hash links
 * work without JavaScript); with JavaScript the photo is centred on screen
 * and focused. The strip is a native horizontal scroller, so trackpad
 * momentum, touch and keyboard all work as the platform expects.
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
        <h2 id="checklist-heading" className={styles.label}>Exhibition checklist</h2>
      </div>
      <ol className={styles.strip} data-reveal-children onClick={onClick}>
        {plates.map((p) => {
          const ratio = p.width && p.height ? Math.min(2, Math.max(0.6, p.width / p.height)) : 1.333;
          return (
            <li key={p.id} className={styles.item} style={{ ["--r" as string]: ratio }}>
              <a href={`#${p.id}`} className={styles.link} aria-label={`Plate ${p.n}: ${p.alt || "photograph"}. Go to photograph`}>
                <span className={styles.frame}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- body URLs are already CDN renditions */}
                  <img src={p.src} alt="" loading="lazy" decoding="async" data-fade className={styles.img} />
                </span>
                <span className={styles.caption} aria-hidden="true">Plate {p.n}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
