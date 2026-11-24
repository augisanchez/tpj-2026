"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { ReactNode, useState } from "react";
import styles from "./MobileDrawer.module.css";

type NavLink = { label: string; href: string };

/** A photographer behind one of the newest stories. */
export type DrawerPhotographer = { name: string; slug: string };

export function MobileDrawer({
  links,
  recent = [],
  trigger,
}: {
  links: NavLink[];
  recent?: DrawerPhotographer[];
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Content
          className={styles.content}
          aria-describedby={undefined}
        >
          <Dialog.Title className={styles.srOnly}>Menu</Dialog.Title>
          <nav className={styles.nav} aria-label="Mobile primary">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={styles.link}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/search"
              className={styles.link}
              onClick={() => setOpen(false)}
            >
              Search
            </Link>
          </nav>
          {recent.length > 0 && (
            <section className={styles.recent} aria-labelledby="drawer-recent">
              <h2 id="drawer-recent" className={styles.recentLabel}>
                Recently published
              </h2>
              <ul className={styles.recentList}>
                {recent.map((p) => (
                  <li key={p.slug}>
                    <Link
                      href={`/photographer/${p.slug}`}
                      prefetch={false}
                      className={styles.recentLink}
                      onClick={() => setOpen(false)}
                    >
                      {p.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
