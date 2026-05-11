"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MobileDrawer } from "./MobileDrawer";
import styles from "./Nav.module.css";

const NAV_LINKS = [
  { label: "Explore", href: "/explore" },
  { label: "Themes", href: "/themes" },
  { label: "Photographers", href: "/photographers" },
  { label: "About", href: "/about" },
  { label: "Shop", href: "/shop" },
];

const DRAWER_LINKS = [
  ...NAV_LINKS,
  { label: "Submit", href: "/submit" },
];

const DEAD_ZONE = 16;
const REVEAL_DELTA = 8;

export function Nav() {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const dy = y - lastY.current;

        if (y < DEAD_ZONE) {
          setHidden(false);
        } else if (dy > 0) {
          setHidden(true);
        } else if (dy < -REVEAL_DELTA) {
          setHidden(false);
        }

        lastY.current = y;
        ticking.current = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`${styles.nav}${hidden ? " " + styles.hidden : ""}`}>
      <Link href="/" className={styles.brand} aria-label="The Photographic Journal">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/svg/wordmark.svg"
          alt="The Photographic Journal"
          className={styles.wordmark}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/svg/tpj_black.svg" alt="TPJ" className={styles.mark} />
      </Link>

      <nav className={styles.links} aria-label="Primary">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`${styles.link} ${styles.desktopLink}`}
          >
            {link.label}
          </Link>
        ))}
        <Link href="/search" aria-label="Search" className={styles.search}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </Link>
        <MobileDrawer
          links={DRAWER_LINKS}
          trigger={
            <button type="button" aria-label="Open menu" className={styles.hamburger}>
              <span />
              <span />
              <span />
            </button>
          }
        />
      </nav>
    </header>
  );
}
