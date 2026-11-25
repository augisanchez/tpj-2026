"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { ReactNode, useState } from "react";
import { Icon, type IconName } from "./Icon";
import styles from "./MobileDrawer.module.css";

/** A menu link; an icon, when given, is set before the word. */
export type DrawerLink = { label: string; href: string; icon?: IconName };

/** A photographer behind one of the newest stories. */
export type DrawerPhotographer = { name: string; slug: string };

export function MobileDrawer({
  links,
  recent = [],
  trigger,
}: {
  links: DrawerLink[];
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
                // /random picks on every visit; a prefetch would fix the pick.
                prefetch={link.href === "/random" ? false : undefined}
                onClick={() => setOpen(false)}
              >
                {link.icon ? (
                  <span>
                    <Icon name={link.icon} inline className={styles.icon} />
                    {link.label}
                  </span>
                ) : (
                  link.label
                )}
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
                      href={`/artist/${p.slug}`}
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
