"use client";

import { usePathname } from "next/navigation";
import styles from "./PageTransition.module.css";

const DETAIL_PATTERN = /^\/(essay|interview|feature|photographer|theme)\//;

type Props = {
  children: React.ReactNode;
};

/**
 * Remounts main content on route change to trigger CSS-driven fade-in.
 *
 * - Top-level / index pages get a 200ms cross-fade.
 * - Detail pages (single article, photographer, theme) get a 300ms
 *   fade with an 8px lift to signal a focal view.
 *
 * Reduced-motion users get no animation. Nav and Footer are outside this
 * wrapper so they persist visually across navigation.
 */
export function PageTransition({ children }: Props) {
  const pathname = usePathname();
  const isDetail = DETAIL_PATTERN.test(pathname);
  const className = `${styles.transition}${isDetail ? " " + styles.detail : ""}`;

  return (
    <div key={pathname} className={className}>
      {children}
    </div>
  );
}
