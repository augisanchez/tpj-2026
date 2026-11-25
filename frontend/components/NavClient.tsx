"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { MobileDrawer, type DrawerLink, type DrawerPhotographer } from "./MobileDrawer";
import styles from "./Nav.module.css";

const NAV_LINKS = [
  { label: "Explore", href: "/explore" },
  { label: "Themes", href: "/themes" },
  { label: "Artists", href: "/artists" },
  { label: "About", href: "/about" },
  { label: "Shop", href: "/shop" },
  { label: "Submit", href: "/submit" },
];

// The menu also carries Contact and Random (the desktop header has no
// room for Contact; its Random is the shuffle icon beside Search). Random
// goes to a random story via /random.
const DRAWER_LINKS: DrawerLink[] = [
  ...NAV_LINKS,
  { label: "Contact", href: "/contact" },
  { label: "Random", href: "/random", icon: "shuffle" },
];

const DEAD_ZONE = 16;
const REVEAL_DELTA = 8;

export function NavClient({ recent }: { recent: DrawerPhotographer[] }) {
  const [hidden, setHidden] = useState(false);
  // Watermark: on once the reader is past the top of the page, off
  // while the footer (which carries its own wordmark) is on screen.
  const [scrolled, setScrolled] = useState(false);
  const [footerInView, setFooterInView] = useState(false);
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

        setScrolled(y > 320);
        lastY.current = y;
        ticking.current = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    const footer = document.querySelector("footer");
    const io = footer
      ? new IntersectionObserver(([e]) => setFooterInView(e.isIntersecting))
      : null;
    if (footer && io) io.observe(footer);
    return () => {
      window.removeEventListener("scroll", onScroll);
      io?.disconnect();
    };
  }, []);

  const showMark = scrolled && !footerInView;

  return (
    <>
    {/* The TPJ mark sits in the bottom-right corner once the reader has
        scrolled (large screens only), so the brand is always on screen. */}
    <Link
      href="/"
      className={styles.watermark}
      data-on={showMark ? "" : undefined}
      aria-label="The Photographic Journal, front page"
      aria-hidden={showMark ? undefined : true}
      tabIndex={showMark ? undefined : -1}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/svg/tpj_black.svg" alt="" />
    </Link>
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
        {/* Prefetch off: /random answers router prefetches with an empty
            204 so each click lands on a fresh pick. */}
        <Link
          href="/random"
          prefetch={false}
          aria-label="Random"
          className={`${styles.search} ${styles.shuffle}`}
        >
          <Icon name="shuffle" />
        </Link>
        <Link href="/search" aria-label="Search" className={styles.search}>
          <Icon name="search" />
        </Link>
        <MobileDrawer
          links={DRAWER_LINKS}
          recent={recent}
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
    </>
  );
}
