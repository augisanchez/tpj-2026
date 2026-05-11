"use client";

import { useEffect, useState } from "react";
import styles from "./ScrollCue.module.css";

/**
 * Subtle scroll-down hint shown immediately below the homepage hero.
 * Bobs gently to draw the eye, fades out once the visitor has scrolled
 * past the first 80px so it doesn't follow them down the page.
 */
export function ScrollCue() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onScroll = () => setHidden(window.scrollY > 80);
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
      <svg
        className={styles.arrow}
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"
          fill="currentColor"
        />
      </svg>
    </div>
  );
}
