"use client";

import { usePathname } from "next/navigation";
import styles from "./PageTransition.module.css";

// Top-level destinations get the full RouteCurtain transition. Content
// pages (essays, interviews, features, individual photographers, theme
// detail) get this lighter inline reveal so the editor isn't stuck
// waiting on a curtain every time they open a single piece.
const TOP_LEVEL_PATHS = new Set<string>([
  "/",
  "/explore",
  "/themes",
  "/photographers",
  "/about",
  "/shop",
  "/submit",
  "/search",
  "/contact",
]);

type Props = {
  children: React.ReactNode;
};

/**
 * Content build-on. Wraps the main route output and fades it up on
 * mount when the destination is a content route. Top-level routes
 * skip the fade — the curtain already provided the reveal animation
 * and layering both would feel like over-design.
 *
 * The key={pathname} forces a remount on every route change, so the
 * fade-in CSS runs each time. For top-level routes the className is
 * empty and the element renders without animation.
 */
export function PageTransition({ children }: Props) {
  const pathname = usePathname();
  const isContent = !TOP_LEVEL_PATHS.has(pathname);

  return (
    <div
      key={pathname}
      className={isContent ? styles.contentReveal : undefined}
    >
      {children}
    </div>
  );
}
