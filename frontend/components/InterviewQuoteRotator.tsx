import Link from "next/link";
import { TpjImage } from "./TpjImage";
import styles from "./InterviewQuoteRotator.module.css";

export type InterviewQuote = {
  id: string;
  slug: string;
  attribution: string;
  quote: string;
  image: { src: string; alt: string } | null;
};

type Props = {
  quotes: InterviewQuote[];
};

export function InterviewQuoteRotator({ quotes }: Props) {
  if (quotes.length === 0) return null;
  // The query returns quotes in random order; render the first.
  const pick = quotes[0];

  return (
    <section className={styles.section} aria-label="Interview excerpt">
      <Link
        href={`/interview/${pick.slug}`}
        className={styles.block}
        data-reveal="wipe"
        data-pz
        style={{ "--pz-range": "0.8%" } as React.CSSProperties}
      >
        {pick.image && (
          <TpjImage
            className={`${styles.image} pz-media`}
            src={pick.image.src}
            alt={pick.image.alt}
            sizes="100vw"
          />
        )}
        <div className={styles.copy}>
          <blockquote className={styles.quote} data-reveal>
            <p>&ldquo;{pick.quote}&rdquo;</p>
          </blockquote>
          <p className={styles.attribution} data-reveal>
            <span className={styles.attributionName}>{pick.attribution}</span>
            <span className={styles.attributionArrow} aria-hidden="true">
              →
            </span>
          </p>
        </div>
      </Link>
    </section>
  );
}
