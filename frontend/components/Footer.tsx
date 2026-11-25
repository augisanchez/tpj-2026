import Link from "next/link";
import { Icon, type IconName } from "./Icon";
import styles from "./Footer.module.css";

// Text-led: an icon, when given, sits before the word at text size.
const FOOTER_LINKS: { label: string; href: string; icon?: IconName }[] = [
  { label: "Explore", href: "/explore" },
  { label: "Artists", href: "/artists" },
  { label: "Themes", href: "/themes" },
  { label: "About", href: "/about" },
  { label: "Submit", href: "/submit" },
  { label: "Contact", href: "/contact" },
  { label: "Shop", href: "/shop" },
  { label: "Random", href: "/random", icon: "shuffle" },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.row}>
        <nav className={styles.links} aria-label="Footer">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={styles.link}
              // /random picks on every visit; a prefetch would fix the pick.
              prefetch={link.href === "/random" ? false : undefined}
            >
              {link.icon && <Icon name={link.icon} inline className={styles.icon} />}
              {link.label}
            </Link>
          ))}
        </nav>
        <p className={styles.copyright}>
          &copy; {year}{" "}The Photographic Journal &middot; Est. 2012
        </p>
      </div>

      {/* The journal's name, oversized and cropped by the footer's bottom
          edge. Decorative: the copyright line already names the site. It
          rises into place once, as the footer enters view (MotionRoot). */}
      <div className={styles.crop} aria-hidden="true">
        <p className={styles.wordmark} data-reveal>
          <span>The</span> <span>Photographic</span> <span>Journal</span>
        </p>
      </div>
    </footer>
  );
}
