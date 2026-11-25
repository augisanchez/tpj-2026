import type { ReactNode } from "react";
import styles from "./ArticlePrefooter.module.css";

/**
 * The end of a story, in one light grey band that runs edge to edge into
 * the footer: who made it, the photographs, then what to read next. The
 * content holds to the story's two-thirds width (the width of its
 * fig-two-thirds photographs), centered.
 */
export function ArticlePrefooter({ children }: { children: ReactNode }) {
  return (
    <div className={styles.band}>
      <div className={styles.inner}>{children}</div>
    </div>
  );
}
