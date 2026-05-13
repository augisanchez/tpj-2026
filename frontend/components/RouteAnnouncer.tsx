"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Screen-reader announcement of SPA route changes. App Router
 * navigations don't move focus or fire the same "page loaded" signal
 * as full page loads, so assistive tech can miss them. This component
 * mirrors what Next.js's pages-router did automatically: it watches
 * pathname, reads the freshly-mounted document.title, and surfaces it
 * via an aria-live region.
 *
 * Skips the initial mount — the first render is the page the visitor
 * arrived at via URL/refresh, not a navigation, and full-page-load
 * announcements are already handled by the browser/AT.
 */
export function RouteAnnouncer() {
  const pathname = usePathname();
  const [message, setMessage] = useState("");
  const initialMountRef = useRef(true);

  useEffect(() => {
    if (initialMountRef.current) {
      initialMountRef.current = false;
      return;
    }
    // Defer one frame so the route's metadata has applied
    // document.title before we read it.
    const id = window.setTimeout(() => {
      const title = document.title.trim();
      setMessage(title ? `Navigated to ${title}` : "Page changed");
    }, 100);
    return () => window.clearTimeout(id);
  }, [pathname]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: "absolute",
        width: "1px",
        height: "1px",
        padding: 0,
        margin: "-1px",
        overflow: "hidden",
        clip: "rect(0, 0, 0, 0)",
        whiteSpace: "nowrap",
        border: 0,
      }}
    >
      {message}
    </div>
  );
}
