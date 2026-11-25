import Link from "./SmartLink";
import { ArtistLinks } from "./ArtistLinks";
import { ExhibitionChecklist } from "./ExhibitionChecklist";
import { PhotographerAvatar } from "./PhotographerAvatar";
import { CONTENT_TYPES, countStories, type ContentType } from "@/lib/content-types";
import type { Photographer } from "@/lib/photographer-types";
import type { Plate } from "@/lib/exhibition";
import styles from "./ArticleEndMatter.module.css";

/** From this many photographs, the photographs get two-thirds of the row. */
const MANY_PLATES = 12;

type Props = {
  photographers: Photographer[];
  plates: Plate[];
  /** Names the story in the photographs title: "Photographs in this interview". */
  type: ContentType;
  /** Credits colophon from the story body (model, styling...). */
  credits?: string;
};

/**
 * The end of every story, inside the pre-footer band: who made it (and
 * the story's credits) on the left, every photograph in it on the right,
 * centered on each other. Stacks on phones, bio first. Either half renders alone when
 * the other has nothing to show.
 */
export function ArticleEndMatter({ photographers, plates, type, credits }: Props) {
  const hasPeople = photographers.length > 0;
  const hasPlates = plates.length > 0;
  if (!hasPeople && !hasPlates) return null;

  return (
    <div
      className={`${styles.endMatter}${hasPeople && plates.length >= MANY_PLATES ? " " + styles.many : ""}`}
    >
      {hasPeople && (
        <section className={styles.about} aria-labelledby="about-heading" data-reveal>
          <h2 id="about-heading" className={styles.label}>
            {photographers.length > 1 ? "About the photographers" : "About the photographer"}
          </h2>
          {photographers.map((p) => (
            <div key={p.slug} className={styles.person}>
              <Link href={`/artist/${p.slug}`} className={styles.head} data-pz>
                <span className={styles.portrait}>
                  <PhotographerAvatar
                    name={p.name}
                    portrait={p.portrait}
                    className={`${styles.portraitImg} pz-media`}
                    sizes="112px"
                    widths={[320]}
                  />
                </span>
                <span className={styles.who}>
                  <span className={styles.name}>{p.name}</span>
                  {p.articleCount > 0 && (
                    <span className={styles.count}>
                      {countStories(p.articleCount)}
                      <span className={styles.arrow} aria-hidden="true">→</span>
                    </span>
                  )}
                </span>
              </Link>
              {p.bio && <p className={styles.bio}>{p.bio}</p>}
              <ArtistLinks name={p.name} links={p.socials} align="start" />
            </div>
          ))}
          {credits && (
            <div className={styles.credits} dangerouslySetInnerHTML={{ __html: credits }} />
          )}
        </section>
      )}
      {hasPlates && (
        <div className={styles.photos}>
          <ExhibitionChecklist
            plates={plates}
            embedded
            title={`Photographs in this ${CONTENT_TYPES[type].one}`}
          />
        </div>
      )}
    </div>
  );
}
