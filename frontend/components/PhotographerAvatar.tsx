"use client";

import { useState } from "react";
import { TpjImage } from "./TpjImage";
import styles from "./PhotographerAvatar.module.css";

type Props = {
  name: string;
  portrait?: { src: string; alt: string };
  className?: string;
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

export function PhotographerAvatar({ name, portrait, className }: Props) {
  const [errored, setErrored] = useState(false);

  if (portrait && !errored) {
    return (
      <TpjImage
        className={className}
        src={portrait.src}
        alt={portrait.alt}
        sizes="200px"
        widths={[96, 200, 400]}
        onError={() => setErrored(true)}
      />
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
