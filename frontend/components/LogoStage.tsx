"use client";

import { useEffect, useState } from "react";
import styles from "./LogoStage.module.css";

const CAMERA_FRAMES = [
  "/svg/cameras/camera-1.svg",
  "/svg/cameras/camera-2.svg",
  "/svg/cameras/camera-3.svg",
  "/svg/cameras/camera-4.svg",
  "/svg/cameras/camera-5.svg",
  "/svg/cameras/camera-6.svg",
];
const FRAME_MS = 120;

type Props = {
  /** overlay: fixed over the page during a transition. inline: fills main (loading.tsx). */
  variant?: "overlay" | "inline";
  visible?: boolean;
};

/**
 * The animated TPJ logo (cycling camera silhouettes over the wordmark),
 * on the page's own background. Plays between pages and doubles as the
 * loading state, so the site has a single waiting state.
 */
export function LogoStage({ variant = "inline", visible = true }: Props) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!visible) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setFrame((f) => (f + 1) % CAMERA_FRAMES.length), FRAME_MS);
    return () => window.clearInterval(id);
  }, [visible]);

  return (
    <div
      className={`${styles.stage} ${styles[variant]}${visible ? " " + styles.visible : ""}`}
      data-logo-stage={variant}
      aria-hidden="true"
    >
      <div className={styles.stack}>
        <div className={styles.cameraWrap}>
          {CAMERA_FRAMES.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src}
              src={src}
              alt=""
              // Lazy so React doesn't emit a preload for the overlay art on
              // every page; it's tiny and loads in the background.
              loading="lazy"
              decoding="async"
              className={styles.camera}
              style={{ opacity: i === frame ? 1 : 0 }}
            />
          ))}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/svg/wordmark.svg" alt="" loading="lazy" decoding="async" className={styles.wordmark} />
      </div>
    </div>
  );
}
