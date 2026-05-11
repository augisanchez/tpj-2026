"use client";

import { useRef } from "react";
import { ImageViewer } from "./ImageViewer";
import styles from "./ArticleBody.module.css";

type Props = {
  html: string;
  /**
   * Feature-template variant: constrains every block (prose AND
   * figures) to the same centered 680px column so the page reads as
   * one tight column. Without this flag, figures span the full body
   * width while prose sits at 680px, creating an off-center visual.
   * Vertical rhythm and text alignment both match the essay/interview
   * default — only the figure width changes.
   */
  centered?: boolean;
};

export function ArticleBody({ html, centered = false }: Props) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const className = `${styles.body}${centered ? " " + styles.centered : ""}`;
  return (
    <>
      <div
        ref={bodyRef}
        className={className}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <ImageViewer containerRef={bodyRef} />
    </>
  );
}
