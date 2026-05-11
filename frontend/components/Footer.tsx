import Link from "next/link";
import styles from "./Footer.module.css";

const FOOTER_LINKS = [
  { label: "Explore", href: "/explore" },
  { label: "Photographers", href: "/photographers" },
  { label: "Themes", href: "/themes" },
  { label: "About", href: "/about" },
  { label: "Submit", href: "/submit" },
  { label: "Contact", href: "/contact" },
  { label: "Shop", href: "/shop", external: true },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.brand}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/svg/tpj_black.svg" alt="The Photographic Journal" className={styles.mark} />
        <p className={styles.copyright}>
          &copy; {year} The Photographic Journal
        </p>
        <p className={styles.est}>Est. 2012</p>
      </div>

      <nav className={styles.links} aria-label="Footer">
        {FOOTER_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={styles.link}
            {...(link.external
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
