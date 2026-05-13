import styles from "./SkipToContent.module.css";

/**
 * Keyboard-first navigation aid. Renders as the first focusable
 * element on every page; remains visually hidden until focused, then
 * appears as a high-contrast pill in the top-left and jumps the user
 * past the nav into the main content region.
 *
 * Skips the navigation tab trap reported during the May 2026 a11y
 * pass. Pairs with `<main id="main-content" tabIndex={-1}>` in
 * `app/layout.tsx` so focus lands inside the main region (the
 * tabIndex=-1 makes the region focusable without putting it in the
 * tab order).
 */
export function SkipToContent() {
  return (
    <a href="#main-content" className={styles.link}>
      Skip to content
    </a>
  );
}
