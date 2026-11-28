import Link from "./SmartLink";
import { ArtistLinks } from "./ArtistLinks";
import { ExhibitionChecklist } from "./ExhibitionChecklist";
import { PhotographerAvatar } from "./PhotographerAvatar";
import { CONTENT_TYPES, TYPE_LABELS, type ContentType } from "@/lib/content-types";
import type { ArtistMore } from "@/lib/queries/related-stories";
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
  /** Each artist's other stories (lib/queries/related-stories.ts). An
   *  artist with none gets no profile link: their profile would only
   *  repeat this block. */
  more?: ArtistMore[];
};

const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

/** "29 photo essays, 1 interview", only when there's more than one kind. */
function breakdown(items: { type: ContentType }[]): string | null {
  const order: ContentType[] = ["essay", "interview", "feature"];
  const parts = order
    .map((t) => [t, items.filter((i) => i.type === t).length] as const)
    .filter(([, n]) => n > 0);
  if (parts.length < 2) return null;
  return parts.map(([t, n]) => plural(n, TYPE_LABELS[t].toLowerCase())).join(", ");
}

/** "3 more stories", or "2 more photo essays" when they're all one kind. */
function moreLine(items: { type: ContentType }[]): string {
  const kinds = new Set(items.map((i) => i.type));
  const noun = kinds.size === 1 ? TYPE_LABELS[items[0].type].toLowerCase() : "story";
  const n = items.length;
  const word = n === 1 ? noun : noun === "story" ? "stories" : `${noun}s`;
  return `${n} more ${word}`;
}

/**
 * The end of every story, inside the pre-footer band: who made it (and
 * the story's credits) on the left, every photograph in it on the right,
 * centered on each other. Stacks on phones, bio first. Either half renders alone when
 * the other has nothing to show.
 */
export function ArticleEndMatter({ photographers, plates, type, credits, more = [] }: Props) {
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
          {photographers.map((p) => {
            const others = more.find((m) => m.slug === p.slug)?.items ?? [];
            const face = (
              <>
                <span className={styles.portrait}>
                  <PhotographerAvatar
                    name={p.name}
                    portrait={p.portrait}
                    className={`${styles.portraitImg} pz-media`}
                    sizes="112px"
                    widths={[320]}
                  />
                </span>
                <span className={styles.name}>{p.name}</span>
              </>
            );
            const types = breakdown(others);
            return (
              <div key={p.slug} className={styles.person}>
                {others.length > 0 ? (
                  <Link href={`/artist/${p.slug}`} className={`${styles.head} ${styles.headLink}`} data-pz>
                    {face}
                  </Link>
                ) : (
                  <div className={styles.head}>{face}</div>
                )}
                {p.bio && <p className={styles.bio}>{p.bio}</p>}
                <ArtistLinks name={p.name} links={p.socials} align="start" />
                {others.length > 0 && (
                  <div className={styles.more}>
                    <Link href={`/artist/${p.slug}`} className={styles.moreButton}>
                      View profile
                      <span className={styles.arrow} aria-hidden="true">→</span>
                    </Link>
                    <p className={styles.moreInfo}>
                      {moreLine(others)}
                      {types && ` (${types})`}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
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
