import styles from "./PurposeStatement.module.css";

export function PurposeStatement() {
  return (
    <section className={styles.section} aria-label="About the publication">
      <p className={styles.statement}>
        Since 2012 The Photographic Journal publishes photo essays,
        photographer interviews, and topical features looking to explore
        creativity and artistic intent.
      </p>
    </section>
  );
}
