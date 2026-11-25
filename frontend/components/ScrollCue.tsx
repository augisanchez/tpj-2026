"use client";

import { useEffect, useState } from "react";
import styles from "./ScrollCue.module.css";

/**
 * Subtle scroll-down hint shown immediately below the homepage hero.
 * Bobs gently to draw the eye, fades out once the visitor has scrolled
 * past the first 80px so it doesn't follow them down the page.
 */
const ARROWS = [
  "M6 9l6 6 6-6",
  "M12 4v15M6 13l6 6 6-6",
  "M6 6l6 6 6-6M6 12l6 6 6-6",
];

export function ScrollCue() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    // Hide once the reader has scrolled, or when the page below the hero
    // is already on screen (tall tablets), so the pill never covers a card.
    const onScroll = () => {
      const hero = document.querySelector("main [data-reveal='wipe']");
      const heroBottom = hero ? hero.getBoundingClientRect().bottom : 0;
      setHidden(window.scrollY > 80 || heroBottom < window.innerHeight - 160);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`${styles.cue}${hidden ? " " + styles.hidden : ""}`}
      aria-hidden="true"
    >
      <span className={styles.label}>Continue</span>
      {/* Three arrows take turns dropping through the slot: chevron,
          arrow, double chevron. Same stroke grid as components/Icon. */}
      <span className={styles.arrows}>
        {ARROWS.map((d, i) => (
          <svg key={i} className={styles.arrow} viewBox="0 0 24 24" fill="none">
            <path d={d} />
          </svg>
        ))}
      </span>
    </div>
  );
}
