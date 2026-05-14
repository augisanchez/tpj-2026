import type { Transition, Variants } from "motion/react";

/**
 * Shared spring config + variants for hover treatments on every card
 * surface. The parent (typically `motion.create(Link)`) declares the
 * hover state via `whileHover="hover"`; descendants pick up the same
 * variant key from `imageScaleVariants` and react.
 */

export const cardSpring: Transition = {
  type: "spring",
  stiffness: 220,
  damping: 24,
  mass: 0.6,
};

export const imageScaleVariants: Variants = {
  rest: { scale: 1 },
  hover: { scale: 1.015 },
};
