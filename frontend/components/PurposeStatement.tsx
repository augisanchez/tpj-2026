import styles from "./PurposeStatement.module.css";

export function PurposeStatement() {
  return (
    <section className={styles.section} aria-label="About the publication">
      <p className={styles.statement} data-reveal>
        The Photographic Journal publishes photo essays, photographer
        interviews, and topical features that explore creativity and
        artistic intent.
      </p>
    </section>
  );
}
