"use client";

import Link from "./SmartLink";
import { useEffect, useRef, useState } from "react";
import styles from "./SubmitMarquee.module.css";

/** Lines from the Submit page and the form, verbatim. */
const LINES = [
  "Let us kibbitz.",
  "Make some magic.",
  "The louder and stranger and more itself, the better.",
  "We love you.",
];

/** Drift speed in px per second at rest. */
const SPEED = 70;
/** Scrolling the page kicks the marquee up to this multiple, then it eases back. */
const MAX_BOOST = 5;

function Sequence() {
  return (
    <>
      {LINES.map((line, i) => (
        <span key={line} className={styles.unit}>
          <span className={i % 2 ? styles.outline : styles.solid}>Send us pix</span>
          <span className={styles.chip}>{line}</span>
        </span>
      ))}
    </>
  );
}

/**
 * End-of-essay invitation to submit, as a marquee: "SEND US PIX" in the
 * display face, alternating solid and outlined, between signal-green
 * chips carrying the Submit page's own lines. It drifts on its own and
 * scrolling the page gives it a push that eases off. The whole strip is
 * one link to /submit.
 *
 * Motion rules (WCAG 2.2.2): a pause button, pause on hover and keyboard
 * focus, static under reduced motion, and no animation while off screen.
 */
export function SubmitMarquee() {
  const track = useRef<HTMLSpanElement>(null);
  const [paused, setPaused] = useState(false);
  const hover = useRef(false);
  const pausedRef = useRef(false);
  const onScreen = useRef(false);
  const syncRef = useRef<() => void>(() => {});

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // One copy is half the track; move by exactly that so the loop is seamless.
    const half = el.scrollWidth / 2;
    const a = el.animate(
      [{ transform: "translate3d(0,0,0)" }, { transform: `translate3d(${-half}px,0,0)` }],
      { duration: (half / SPEED) * 1000, iterations: Infinity, easing: "linear" },
    );
    a.pause();

    const sync = () => {
      if (onScreen.current && !hover.current && !pausedRef.current) a.play();
      else a.pause();
    };
    const io = new IntersectionObserver(([e]) => {
      onScreen.current = e.isIntersecting;
      sync();
    });
    io.observe(el);

    // Scroll push: the page's scroll speed sets a boost that decays.
    let lastY = window.scrollY;
    let boost = 1;
    let raf = 0;
    const decay = () => {
      boost = 1 + (boost - 1) * 0.92;
      a.playbackRate = boost;
      raf = boost > 1.02 ? requestAnimationFrame(decay) : 0;
      if (!raf) a.playbackRate = 1;
    };
    const onScroll = () => {
      const y = window.scrollY;
      const dy = Math.abs(y - lastY);
      lastY = y;
      if (!onScreen.current) return;
      boost = Math.min(MAX_BOOST, Math.max(boost, 1 + dy / 12));
      if (!raf) raf = requestAnimationFrame(decay);
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    const root = el.closest("section");
    const enter = () => { hover.current = true; sync(); };
    const leave = () => { hover.current = false; sync(); };
    root?.addEventListener("pointerenter", enter);
    root?.addEventListener("pointerleave", leave);
    root?.addEventListener("focusin", enter);
    root?.addEventListener("focusout", leave);
    syncRef.current = sync;

    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      root?.removeEventListener("pointerenter", enter);
      root?.removeEventListener("pointerleave", leave);
      root?.removeEventListener("focusin", enter);
      root?.removeEventListener("focusout", leave);
      a.cancel();
    };
  }, []);

  const toggle = () => {
    const next = !paused;
    setPaused(next);
    pausedRef.current = next;
    syncRef.current();
  };

  return (
    <section className={styles.section} aria-label="Submit your photographs">
      <Link href="/submit" className={styles.link} aria-label="Send us pix: submit your photographs">
        <span ref={track} className={styles.track} aria-hidden="true">
          <Sequence />
          <Sequence />
        </span>
      </Link>
      <button
        type="button"
        className={styles.pause}
        onClick={toggle}
        aria-pressed={paused}
        aria-label={paused ? "Play the marquee" : "Pause the marquee"}
      >
        {paused ? (
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="currentColor" /></svg>
        ) : (
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" fill="currentColor" /></svg>
        )}
      </button>
    </section>
  );
}
