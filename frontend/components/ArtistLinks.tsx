import { Icon, type IconName } from "./Icon";
import styles from "./ArtistLinks.module.css";

/** Icon per link label (labels come from lib/social-links.ts). */
const LINK_ICONS: Record<string, IconName> = {
  Website: "globe",
  Blog: "globe",
  Instagram: "instagram",
  Twitter: "x",
  Facebook: "facebook",
  Flickr: "flickr",
};

type Props = {
  name: string;
  links?: { label: string; href: string }[];
  /** Center the row (under a centered card) or start it (in a bio). */
  align?: "center" | "start";
};

/**
 * An artist's own sites, as the old site showed under each story: quiet
 * round icons that fill green on hover, the destination in the shared
 * tooltip.
 */
export function ArtistLinks({ name, links, align = "center" }: Props) {
  if (!links || links.length === 0) return null;
  return (
    <ul
      className={`${styles.social}${align === "start" ? " " + styles.start : ""}`}
      aria-label={`${name} elsewhere`}
    >
      {links.map((link) => (
        <li key={link.href}>
          <a
            href={link.href}
            className={styles.socialLink}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${name} on ${link.label} (opens in a new tab)`}
            data-tip={link.label}
          >
            <Icon name={LINK_ICONS[link.label] ?? "link"} size={20} />
          </a>
        </li>
      ))}
    </ul>
  );
}
