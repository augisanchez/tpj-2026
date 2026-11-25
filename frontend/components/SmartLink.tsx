"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";

type Props = ComponentProps<typeof Link> & {
  /**
   * "intent" (default): prefetch only when the reader shows intent
   * (hover, touch, keyboard focus). Cards and grids use this, so a page
   * full of links no longer downloads every destination up front.
   * "viewport": Next's normal prefetch-when-visible. Navigation uses it.
   * Either way, nothing is prefetched on data saver or a 3G-or-slower
   * connection.
   */
  prefetchMode?: "intent" | "viewport";
};

/** Data saver on, or Chromium reports 3G or slower. Safari and Firefox
 *  don't expose this, so they always count as fast. */
export function isSlowConnection(): boolean {
  if (typeof navigator === "undefined") return false;
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (!c) return false;
  return !!c.saveData || ["slow-2g", "2g", "3g"].includes(c.effectiveType ?? "");
}

/** next/link with bandwidth-aware prefetching (see prefetchMode). */
export default function SmartLink({ prefetch, prefetchMode = "intent", onMouseEnter, onTouchStart, onFocus, ...rest }: Props) {
  const [intent, setIntent] = useState(false);
  // An explicit prefetch={false} (e.g. /random) always wins.
  if (prefetch === false || isSlowConnection()) return <Link {...rest} prefetch={false} onMouseEnter={onMouseEnter} onTouchStart={onTouchStart} onFocus={onFocus} />;
  if (prefetchMode === "viewport") return <Link {...rest} prefetch={prefetch} onMouseEnter={onMouseEnter} onTouchStart={onTouchStart} onFocus={onFocus} />;
  // Intent: off until hover/touch/focus, then Next's default prefetch
  // (null) runs for this link, which is on screen by definition.
  return (
    <Link
      {...rest}
      prefetch={intent ? (prefetch ?? null) : false}
      onMouseEnter={(e) => {
        onMouseEnter?.(e);
        setIntent(true);
      }}
      onTouchStart={(e) => {
        onTouchStart?.(e);
        setIntent(true);
      }}
      onFocus={(e) => {
        onFocus?.(e);
        setIntent(true);
      }}
    />
  );
}

/** Navigation links: normal prefetch on fast connections, none on slow. */
export function NavLink(props: Props) {
  return <SmartLink prefetchMode="viewport" {...props} />;
}
