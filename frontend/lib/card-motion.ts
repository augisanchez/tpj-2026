import type { Transition, Variants } from "motion/react";

/**
 * Shared spring config + variants for hover treatments on every card
 * surface (ArticleCard, HomepageHero, ArchiveFeatureCard,
 * PhotographerListCard, ShopPage card, ThemesIndex card).
 *
 * The parent (typically `motion.create(Link)`) declares the hover
 * state via `whileHover="hover"`; descendants pick up the same
 * variant key from `imageScaleVariants` / `titleAccentVariants` and
 * react. CSS-only scales were uniform but pinned to an `ease`
 * cubic-bezier; spring gives a slight overshoot and decay that
 * reads as more alive without changing the design vocabulary.
 */

export const cardSpring: Transition = {
  type: "spring",
  stiffness: 220,
  damping: 24,
  mass: 0.6,
};

/**
 * Subtle scale variant for card images / thumbnails. Matches the
 * prior CSS 1.015 ceiling so visual impact is unchanged — only the
 * motion physics improves.
 */
export const imageScaleVariants: Variants = {
  rest: { scale: 1 },
  hover: { scale: 1.015 },
};

/**
 * Lime underline that draws in beneath the card title on hover.
 * scaleX 0 → 1, transform-origin left. Editorial complement to the
 * image scale — typographic reaction without competing for attention.
 */
export const titleAccentVariants: Variants = {
  rest: { scaleX: 0 },
  hover: { scaleX: 1 },
};

export const titleAccentTransition: Transition = {
  duration: 0.32,
  ease: [0.2, 0.6, 0.2, 1],
};
