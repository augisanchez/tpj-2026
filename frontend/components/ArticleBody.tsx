"use client";

import { useRef } from "react";
import { ImageViewer } from "./ImageViewer";
import styles from "./ArticleBody.module.css";

type Props = {
  html: string;
};

export function ArticleBody({ html }: Props) {
  const bodyRef = useRef<HTMLDivElement>(null);
  return (
    <>
      <div
        ref={bodyRef}
        className={styles.body}
        data-img-body=""
        data-reveal-scope
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <ImageViewer containerRef={bodyRef} />
    </>
  );
}
