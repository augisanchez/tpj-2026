"use client";

import { useEffect, useRef, useState } from "react";
import type { IndexPerson, IndexRow } from "./StoryIndexList";
import styles from "./StoryIndex.module.css";

type Props = {
  /** id of the <ol>; a linked credit is a row's second link. */
  listId: string;
  /** The rows, in list order; a linked credit carries its person. */
  rows: IndexRow[];
};

const GAP = 8;
/** A linked credit: the second link in a row. */
const CREDIT = "li > a:nth-child(2)";

/**
 * Hover (or keyboard focus) a photographer's name in the index and a
 * small card with their portrait and work count opens under the name,
 * anchored to it rather than the cursor. Fixed-position, so it never
 * moves the list. Fine pointers only: touch gets the plain list.
 * One listener set on the list, not one per name.
 */
export function IndexPhotographerCard({ listId, rows: data }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [person, setPerson] = useState<IndexPerson | null>(null);

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
    let current: HTMLElement | null = null;
    const rows = new Map<Element, number>();
    [...list.children].forEach((li, i) => rows.set(li, i));

    const place = (link: HTMLElement) => {
      const r = link.getBoundingClientRect();
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const x = Math.min(Math.max(16, r.left), window.innerWidth - w - 16);
      // Under the name; above it when the name sits near the bottom.
      const below = r.bottom + GAP;
      const y = below + h > window.innerHeight - 16 ? r.top - GAP - h : below;
      el.style.translate = `${Math.round(x)}px ${Math.round(y)}px`;
    };

    const show = (link: HTMLElement) => {
      if (link === current) return;
      current = link;
      const p = data[rows.get(link.parentElement!) ?? -1]?.person;
      if (!p) return hide();
      setPerson(p);
      // Place after React has filled the card, so its size is final.
      requestAnimationFrame(() => {
        if (current !== link) return;
        place(link);
        el.dataset.on = "1";
      });
    };
    const hide = () => {
      current = null;
      el.dataset.on = "";
    };

    const linkOf = (t: EventTarget | null) =>
      ((t as Element | null)?.closest?.(CREDIT) as HTMLElement | null) ?? null;

    const onOver = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const link = linkOf(e.target);
      if (link) show(link);
      else if (current) hide();
    };
    const onFocus = (e: FocusEvent) => {
      const link = linkOf(e.target);
      if (link) show(link);
    };

    list.addEventListener("pointerover", onOver, { passive: true });
    list.addEventListener("pointerleave", hide);
    list.addEventListener("focusin", onFocus);
    list.addEventListener("focusout", hide);
    window.addEventListener("scroll", hide, { passive: true });
    return () => {
      list.removeEventListener("pointerover", onOver);
      list.removeEventListener("pointerleave", hide);
      list.removeEventListener("focusin", onFocus);
      list.removeEventListener("focusout", hide);
      window.removeEventListener("scroll", hide);
    };
  }, [enabled, listId, data]);

  if (!enabled) return null;
  const portrait = person?.portrait;
  const count = person?.count ?? 0;
  return (
    <div ref={box} className={styles.person} aria-hidden="true" data-on="">
      <div className={styles.personPhoto} data-skeleton="">
        {portrait ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={portrait}
            src={portrait}
            alt=""
            decoding="async"
            onLoad={(e) => {
              e.currentTarget.dataset.ready = "1";
            }}
          />
        ) : (
          <span>{initials(person?.name ?? "")}</span>
        )}
      </div>
      {count > 0 && (
        <p className={styles.personCount}>
          {count} {count === 1 ? "story" : "stories"}
        </p>
      )}
    </div>
  );
}

function initials(name: string) {
  const parts = name.split(/\s+/).filter((p) => /[A-Za-z]/.test(p));
  if (!parts.length) return "";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}
