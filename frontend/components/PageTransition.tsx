"use client";

import { ViewTransition } from "react";

type Props = {
  children: React.ReactNode;
};

/**
 * Wraps main content in React's <ViewTransition>. Route navigations in
 * the App Router are React Transitions, so this activates a coordinated
 * outgoing-fade + incoming-fade on every navigation. Replaces the prior
 * CSS-keyed remount approach so the outgoing page also animates and so
 * future shared-element morphs (ArticleCard image to article hero) can
 * be added by giving paired elements the same `name` prop.
 *
 * Animation timings and easing live in PageTransition.module.css via
 * the `::view-transition-old(root)` / `::view-transition-new(root)`
 * pseudo-elements. Reduced-motion is honored there.
 */
export function PageTransition({ children }: Props) {
  return <ViewTransition>{children}</ViewTransition>;
}
