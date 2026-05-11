"use client";

import { useRef } from "react";
import { ImageViewer } from "./ImageViewer";
import styles from "./InterviewBody.module.css";

type Props = {
  html: string;
  /** Optional plain-text lede shown above the body (italic, muted). */
  lede?: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function InterviewBody({ html, lede }: Props) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const fullHtml = lede
    ? `<p class="interview-lede">${escapeHtml(lede)}</p>${html}`
    : html;

  return (
    <>
      <div
        ref={bodyRef}
        className={styles.body}
        dangerouslySetInnerHTML={{ __html: fullHtml }}
      />
      <ImageViewer containerRef={bodyRef} />
    </>
  );
}
