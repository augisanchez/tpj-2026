"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { ReactNode, useState } from "react";
import styles from "./MobileDrawer.module.css";

type NavLink = { label: string; href: string };

export function MobileDrawer({
  links,
  trigger,
}: {
  links: NavLink[];
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
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
