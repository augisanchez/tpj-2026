import styles from "./WallLabel.module.css";

type Props = {
  photographer?: string | null;
  title: string;
  year?: number | null;
  count: number;
};

/**
 * Museum wall label under the lead image: who, what and when, and how
 * many photographs hang in the piece. Only data the article already has;
 * no medium, camera or film fields.
 */
export function WallLabel({ photographer, title, year, count }: Props) {
  return (
    <p className={styles.label} data-reveal>
      {/* Interviews are often titled with the photographer's name; skip the repeat. */}
      {photographer && photographer.trim() !== title.trim() && <span className={styles.name}>{photographer}</span>}
      <span className={styles.line}>
        <i>{title}</i>
        {year ? `, ${year}` : null}
      </span>
      {count > 0 && (
        <span className={styles.count}>
          {count} {count === 1 ? "photograph" : "photographs"}
        </span>
      )}
    </p>
  );
}
