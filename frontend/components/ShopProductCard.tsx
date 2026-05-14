"use client";

import { motion } from "motion/react";
import { cardSpring, imageScaleVariants } from "@/lib/card-motion";
import styles from "./ShopPage.module.css";

type Props = {
  title: string;
  variant: string;
  image: string;
  href: string;
  cta?: string;
};

/**
 * Single product card for the shop grid. Lives as its own component
 * so the surrounding shop page can stay a server component (it
 * exports route `metadata`, which client components can't do).
 */
export function ShopProductCard({ title, variant, image, href, cta }: Props) {
  const isExternal = href.startsWith("http");
  return (
    <motion.a
      href={href}
      className={styles.card}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      initial="rest"
      animate="rest"
      whileHover="hover"
    >
      <div className={styles.cardImage}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <motion.img
          src={image}
          alt={title}
          variants={imageScaleVariants}
          transition={cardSpring}
        />
      </div>
      <div className={styles.cardLabel}>
        <h2 className={styles.cardTitle}>{title}</h2>
        <p className={styles.cardVariant}>{variant}</p>
      </div>
      <p className={styles.cardCta}>
        {cta ?? "Shop"}
        <span className={styles.cardCtaArrow} aria-hidden="true">
          {isExternal ? "↗" : "→"}
        </span>
      </p>
    </motion.a>
  );
}
