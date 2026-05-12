"use client";

import { useState, ViewTransition } from "react";
import styles from "./PhotographerAvatar.module.css";

type Props = {
  name: string;
  portrait?: { src: string; alt: string };
  className?: string;
  /**
   * Optional shared-element name. When the portrait img is rendered
   * (not the initials fallback), pairing this name across pages morphs
   * the portrait from card to profile cover on navigation.
   */
  transitionName?: string;
};

/**
 * One-letter for mononyms (Anais → A), first+last initials for the
 * rest (Jane Doe → JD). Skips numeric or punctuation-only tokens so
 * names like "Yana Yatsuk-Smith" still produce YS.
 */
function computeInitials(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return "?";
  const parts = cleaned
    .split(/\s+/)
    .filter((p) => /[A-Za-z]/.test(p));
  if (parts.length === 0) {
    const first = cleaned.charAt(0);
    return first ? first.toUpperCase() : "?";
  }
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  const first = parts[0].charAt(0);
  const last = parts[parts.length - 1].charAt(0);
  return (first + last).toUpperCase();
}

export function PhotographerAvatar({
  name,
  portrait,
  className,
  transitionName,
}: Props) {
  const [errored, setErrored] = useState(false);

  if (portrait && !errored) {
    const imageEl = (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className={className}
        src={portrait.src}
        alt={portrait.alt}
        onError={() => setErrored(true)}
      />
    );
    return transitionName ? (
      <ViewTransition name={transitionName}>{imageEl}</ViewTransition>
    ) : (
      imageEl
    );
  }

  const initials = computeInitials(name);
  const wrapperClass = `${styles.fallback}${className ? " " + className : ""}`;
  return (
    <div className={wrapperClass} role="img" aria-label={name}>
      <span className={styles.initials} aria-hidden="true">
        {initials}
      </span>
    </div>
  );
}
