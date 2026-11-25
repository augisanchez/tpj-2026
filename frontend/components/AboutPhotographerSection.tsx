import { PhotographerListCard } from "./PhotographerListCard";
import { Icon, type IconName } from "./Icon";
import type { Photographer } from "@/lib/photographer-types";
import styles from "./AboutPhotographerSection.module.css";

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
  /** Single photographer (legacy callers / homepage spotlight). */
  photographer?: Photographer;
  /** Multiple photographers — collaborations render one card each. */
  photographers?: Photographer[];
  eyebrow?: string;
};

/**
 * "About the photographer" block at the end of an article. Renders the
 * directory-style PhotographerListCard so the article-end credit
 * matches the photographers index visually. Collaborations get one
 * card per contributor with a pluralized eyebrow.
 */
export function AboutPhotographerSection({
  photographer,
  photographers,
  eyebrow,
}: Props) {
  const list =
    photographers && photographers.length > 0
      ? photographers
      : photographer
        ? [photographer]
        : [];

  if (list.length === 0) return null;

  const label =
    eyebrow ??
    (list.length > 1 ? "About the photographers" : "About the photographer");

  return (
    <section className={styles.section}>
      <p className={styles.eyebrow}>{label}</p>
      <div className={styles.cards}>
        {list.map((p) => (
          <div key={p.slug} className={styles.person}>
            <PhotographerListCard
              name={p.name}
              slug={p.slug}
              articleCount={p.articleCount}
              portrait={p.portrait}
              centered
              compact
            />
            {/* Their own sites, as the old site showed under each story:
                quiet outlines, the destination in the shared tooltip. */}
            {p.socials && p.socials.length > 0 && (
              <ul className={styles.social} aria-label={`${p.name} elsewhere`}>
                {p.socials.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className={styles.socialLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${p.name} on ${link.label} (opens in a new tab)`}
                      data-tip={link.label}
                    >
                      <Icon name={LINK_ICONS[link.label] ?? "link"} size={20} />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
