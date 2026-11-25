"use client";

import Link from "./SmartLink";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArticleCard } from "./ArticleCard";
import { ContentTypeChip } from "./ContentTypeChip";
import { ThemeThumbnail } from "./ThemeThumbnail";
import { THEMES } from "@/lib/themes";
import type { RecentEssay } from "@/lib/queries/recent-essays";
import styles from "./ThemeBrowser.module.css";

type Props = {
  groups: Record<string, RecentEssay[]>;
  /** Covers beyond the 3 shown, for the count tile's 2×2 mosaic. */
  extras?: Record<string, RecentEssay[]>;
  /** Published articles per theme slug. */
  counts?: Record<string, number>;
};

// Story swap. The card frames never move: on a switch the photos and
// text fade out (OUT_MS) and each frame falls back to the loading
// skeleton. The new photos load behind it and fade in as they arrive
// (globals.css "Image loading"); the text rises back in, staggered.
const OUT_MS = 150;
const IN_MS = 420;
const IN_STEP_MS = 60;
const IN_SHIFT = "8px";
// Photos land as a wave: an upward wipe plus fade, one slot after the
// other, however their loads happen to finish.
const PHOTO_MS = 700;
const PHOTO_STEP_MS = 90;
const EASE_IN = "cubic-bezier(0.7, 0, 0.84, 0)";
const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";

const PANEL_ID = "theme-panel";
const tabId = (slug: string) => `theme-tab-${slug}`;

/** Milliseconds on the page clock; only called from handlers and effects. */
function clock() {
  return performance.now();
}

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function Cards({ essays }: { essays: RecentEssay[]; }) {
  return essays.map((essay) => (
    <div key={essay.id}>
      <ArticleCard
        variant="3up"
        article={{
          title: essay.title,
          date: essay.date,
          href: `/essay/${essay.slug}`,
          contentTypeLabel: "Photo Essay",
        }}
      />
    </div>
  ));
}

export function ThemeBrowser({ groups, extras = {}, counts = {} }: Props) {
  // activeSlug drives the tabs; shownSlug drives the panel, and trails
  // activeSlug by the outgoing fade.
  const [activeSlug, setActiveSlug] = useState(THEMES[0].slug);
  const [shownSlug, setShownSlug] = useState(THEMES[0].slug);

  const listRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map());
  const panelRef = useRef<HTMLDivElement>(null);
  const shownRef = useRef(shownSlug);
  const targetRef = useRef(shownSlug);
  const outTimer = useRef(0);
  const entering = useRef(false);
  const mounted = useRef(false);

  const cards = groups[shownSlug] ?? [];
  const activeCount = counts[shownSlug] ?? 0;
  const shownTheme = THEMES.find((t) => t.slug === shownSlug) ?? THEMES[0];
  const remaining = activeCount - cards.length;
  const tileImages = (extras[shownSlug] ?? [])
    .map((e) => (e.featuredImage ? { src: e.featuredImage.src, alt: "" } : null))
    .filter((i): i is { src: string; alt: string } => i !== null)
    .slice(0, 4);

  const panelItems = () =>
    [...(panelRef.current?.children ?? [])] as HTMLElement[];

  // The parts of a slot that swap: a story card's photo and text lines
  // (its first child is the image frame, which stays), or the count
  // tile's cover mosaic.
  const parts = (slot: HTMLElement) => {
    const card = slot.querySelector<HTMLElement>("a");
    if (!card) return { photo: [] as HTMLElement[], text: [] as HTMLElement[] };
    const mosaic = card.querySelector<HTMLElement>(".pz-media");
    if (mosaic) return { photo: [mosaic], text: [] as HTMLElement[] };
    return {
      photo: [...card.querySelectorAll<HTMLElement>("img")],
      text: [...card.children].slice(1) as HTMLElement[],
    };
  };

  const fadeOut = () => {
    panelItems().forEach((slot) => {
      const { photo, text } = parts(slot);
      [...photo, ...text].forEach((el) =>
        // Single keyframe: fades from wherever a running entrance is.
        el.animate([{ opacity: 0 }], { duration: OUT_MS, easing: EASE_IN, fill: "forwards" }),
      );
    });
  };

  const enter = () => {
    const t0 = clock();
    // Delay that keeps slot order even when a photo arrives late.
    const beat = (i: number) => Math.max(0, i * PHOTO_STEP_MS - (clock() - t0));
    panelItems().forEach((slot, i) => {
      // A freshly mounted slot (e.g. the count tile returning) is new to
      // the reveal system; mark it shown so its rise never stacks on ours.
      if (!slot.classList.contains("rv-in")) slot.classList.add("rv-in", "rv-instant");
      const { photo, text } = parts(slot);
      photo.forEach((el) => {
        el.getAnimations().forEach((a) => a.cancel());
        if (el instanceof HTMLImageElement) {
          // The frame shows the skeleton until the photo has arrived
          // (no data-ld), then the photo wipes up into the slot on its
          // beat. data-instant hands the entrance to this animation
          // instead of the site-wide image fade.
          delete el.dataset.ld;
          el.dataset.instant = "1";
          const land = () => {
            el.animate(
              [
                { opacity: 0, clipPath: "inset(100% 0 0 0)" },
                { opacity: 1, clipPath: "inset(0 0 0 0)" },
              ],
              { duration: PHOTO_MS, delay: beat(i), easing: EASE_OUT, fill: "backwards" },
            );
          };
          if (el.complete && el.naturalWidth) {
            el.dataset.ld = "1";
            land();
          } else {
            el.addEventListener("load", land, { once: true });
          }
        } else {
          el.animate(
            [
              { opacity: 0, clipPath: "inset(100% 0 0 0)" },
              { opacity: 1, clipPath: "inset(0 0 0 0)" },
            ],
            { duration: PHOTO_MS, delay: i * PHOTO_STEP_MS, easing: EASE_OUT, fill: "backwards" },
          );
        }
      });
      text.forEach((el) => {
        el.getAnimations().forEach((a) => a.cancel());
        el.animate(
          [
            { opacity: 0, transform: `translateY(${IN_SHIFT})` },
            { opacity: 1, transform: "none" },
          ],
          { duration: IN_MS, delay: i * IN_STEP_MS, easing: EASE_OUT, fill: "backwards" },
        );
      });
    });
  };

  const select = (slug: string) => {
    setActiveSlug(slug);
    targetRef.current = slug;
    if (reducedMotion()) {
      shownRef.current = slug;
      setShownSlug(slug);
      return;
    }
    // A fade is already running: it lands on whatever is chosen last.
    if (outTimer.current || slug === shownRef.current) return;
    fadeOut();
    outTimer.current = window.setTimeout(() => {
      outTimer.current = 0;
      const next = targetRef.current;
      if (next === shownRef.current) {
        enter();
        return;
      }
      shownRef.current = next;
      entering.current = true;
      setShownSlug(next);
    }, OUT_MS);
  };

  useLayoutEffect(() => {
    if (!entering.current) return;
    entering.current = false;
    enter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownSlug]);

  // Phones: keep the active word in view in the scrolling row.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const list = listRef.current;
    const tab = tabRefs.current.get(activeSlug);
    if (!list || !tab || list.scrollWidth <= list.clientWidth) return;
    const pad = parseFloat(getComputedStyle(list).scrollPaddingInlineStart) || 0;
    const left = tab.offsetLeft - pad;
    const right = tab.offsetLeft + tab.offsetWidth + pad;
    if (left >= list.scrollLeft && right <= list.scrollLeft + list.clientWidth) return;
    list.scrollTo({ left, behavior: reducedMotion() ? "auto" : "smooth" });
  }, [activeSlug]);

  useEffect(
    () => () => {
      window.clearTimeout(outTimer.current);
    },
    [],
  );

  // ARIA APG tablist: arrows move focus and select (selection follows
  // focus); Home/End jump to the ends.
  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const len = THEMES.length;
    let next: number;
    if (e.key === "ArrowRight") next = (index + 1) % len;
    else if (e.key === "ArrowLeft") next = (index - 1 + len) % len;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = len - 1;
    else return;
    e.preventDefault();
    const slug = THEMES[next].slug;
    select(slug);
    tabRefs.current.get(slug)?.focus();
  };


  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2 id="themes-label" className={styles.label} data-reveal>
          Themes
        </h2>
        <Link href="/themes" className={styles.exploreLink} data-reveal>
          Explore themes
          <span className={styles.exploreArrow} aria-hidden="true">
            →
          </span>
        </Link>
      </div>

      <div
        ref={listRef}
        className={styles.list}
        role="tablist"
        aria-labelledby="themes-label"
        data-reveal-children
      >
        {THEMES.map((theme, index) => {
          const isActive = theme.slug === activeSlug;
          const count = counts[theme.slug];
          return (
            <button
              key={theme.slug}
              ref={(el) => {
                tabRefs.current.set(theme.slug, el);
              }}
              type="button"
              role="tab"
              id={tabId(theme.slug)}
              aria-selected={isActive}
              aria-controls={PANEL_ID}
              tabIndex={isActive ? 0 : -1}
              className={styles.tab}
              onClick={() => select(theme.slug)}
              onKeyDown={(e) => onKeyDown(e, index)}
            >
              <span className={styles.word}>
                {theme.name}
                {count ? (
                  <span className={styles.count}>
                    <span className={styles.srOnly}>, </span>
                    {count}
                    <span className={styles.srOnly}> stories</span>
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>

      {/* The live panel shares one grid cell with an invisible copy of
          every theme's cards, so the stage is always as tall as the
          tallest set and swapping never moves the page. */}
      <div className={styles.stage}>
        <div
          ref={panelRef}
          id={PANEL_ID}
          role="tabpanel"
          aria-labelledby={tabId(activeSlug)}
          className={styles.cards}
          data-reveal-children
        >
          {cards.map((essay, i) => (
            // Keyed by slot so the elements persist across swaps and the
            // reveal system treats them as already shown.
            <div key={i}>
              <ArticleCard
                variant="3up"
                article={{
                  title: essay.title,
                  date: essay.date,
                  href: `/essay/${essay.slug}`,
                  contentTypeLabel: "Photo Essay",
                  featuredImage: essay.featuredImage ?? undefined,
                  photographer: essay.photographerName,
                }}
              />
            </div>
          ))}
          {remaining > 0 && (
            <div key="more">
              {/* The whole theme behind one link: the cover mosaic with the
                  count left, then the theme named like a card title, with
                  its one-line question. */}
              <Link href={`/theme/${shownSlug}`} className={styles.more}>
                <div className={styles.moreTile} data-pz>
                  <div className="pz-media" style={{ position: "absolute", inset: 0 }}>
                    <ThemeThumbnail images={tileImages} fillParent />
                  </div>
                  <span className={styles.moreCount} aria-hidden="true">+{remaining}</span>
                </div>
                <div className={styles.moreText}>
                  <ContentTypeChip label="Theme" size="medium" />
                  <h3 className={styles.moreTitle}>
                    Explore {shownTheme.name}
                    <span className={styles.srOnly}>, all {activeCount} stories</span>
                  </h3>
                  <p className={styles.morePrompt}>{shownTheme.prompt}</p>
                </div>
              </Link>
            </div>
          )}
        </div>
        {THEMES.map((theme) => (
          <div key={theme.slug} className={`${styles.cards} ${styles.sizer}`} aria-hidden="true" inert>
            <Cards essays={groups[theme.slug] ?? []} />
          </div>
        ))}
      </div>
    </section>
  );
}
