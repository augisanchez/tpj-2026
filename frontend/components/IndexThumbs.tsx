"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./StoryIndex.module.css";

type Props = {
  /** id of the <ol> whose rows the thumbnails belong to. */
  listId: string;
  /** Shared URL prefix; each tail completes one row's image (or ""). */
  prefix: string;
  tails: string[];
};

const OFFSET = 24;

/**
 * Hover (or keyboard focus) a row of the index and a small thumbnail of
 * that story appears beside the cursor. Fixed-position, so it never
 * moves the list. Fine pointers only: touch gets the plain list.
 * One listener pair on the list, not one per row.
 */
export function IndexThumbs({ listId, prefix, tails }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);
  // No <img> until there is a real source to show.
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => setEnabled(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const list = document.getElementById(listId);
    const el = box.current;
    if (!enabled || !list || !el) return;

    const rows = new Map<Element, number>();
    [...list.children].forEach((li, i) => rows.set(li, i));
    let current = -1;
    let raf = 0;
    let pos = { x: 0, y: 0 };

    const place = () => {
      raf = 0;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      let x = pos.x + OFFSET;
      if (x + w > window.innerWidth - 16) x = pos.x - OFFSET - w;
      const y = Math.min(Math.max(16, pos.y - h / 2), window.innerHeight - h - 16);
      el.style.translate = `${Math.round(x)}px ${Math.round(y)}px`;
    };
    const moveTo = (x: number, y: number) => {
      pos = { x, y };
      if (!raf) raf = requestAnimationFrame(place);
    };

    const show = (i: number) => {
      if (i === current) return;
      current = i;
      const tail = tails[i];
      if (!tail) {
        el.dataset.on = "";
        return;
      }
      setSrc(prefix + tail);
      el.dataset.on = "1";
    };
    const hide = () => {
      current = -1;
      el.dataset.on = "";
    };

    const rowOf = (t: EventTarget | null) => {
      const li = (t as Element | null)?.closest?.(`#${CSS.escape(listId)} > li`);
      return li ? (rows.get(li) ?? -1) : -1;
    };

    // A photographer's name has its own card (IndexPhotographerCard).
    const onCredit = (t: EventTarget | null) =>
      !!(t as Element | null)?.closest?.("li > a:nth-child(2)");

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      if (onCredit(e.target)) return hide();
      const i = rowOf(e.target);
      if (i < 0) return hide();
      moveTo(e.clientX, e.clientY);
      show(i);
    };
    const onFocus = (e: FocusEvent) => {
      if (onCredit(e.target)) return hide();
      const i = rowOf(e.target);
      if (i < 0) return;
      // Over the right end of the row (type and year), level with it,
      // so the title and credit stay readable.
      const r = (e.target as HTMLElement).getBoundingClientRect();
      moveTo(r.right - el.offsetWidth - 2 * OFFSET, r.top + r.height / 2);
      show(i);
    };

    list.addEventListener("pointermove", onMove, { passive: true });
    list.addEventListener("pointerleave", hide);
    list.addEventListener("focusin", onFocus);
    list.addEventListener("focusout", hide);
    window.addEventListener("scroll", hide, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      list.removeEventListener("pointermove", onMove);
      list.removeEventListener("pointerleave", hide);
      list.removeEventListener("focusin", onFocus);
      list.removeEventListener("focusout", hide);
      window.removeEventListener("scroll", hide);
    };
  }, [enabled, listId, prefix, tails]);

  if (!enabled) return null;
  return (
    <div ref={box} className={styles.thumb} aria-hidden="true" data-on="">
      {src && (
        // One element per source, so each starts hidden until loaded.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt=""
          decoding="async"
          onLoad={(e) => {
            e.currentTarget.dataset.ready = "1";
          }}
        />
      )}
    </div>
  );
}
