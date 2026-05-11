import styles from "./EssayIntro.module.css";

type Props = {
  text: string;
  /**
   * When true, the lede column constrains to 680px to match the
   * Feature template's tight body column. Default 880px (essays).
   */
  narrow?: boolean;
};

/**
 * Editorial intro / lede displayed above the article body. Uses the
 * larger Inter Medium scale that matches the supporting page banners
 * and the Submit pitch heading. Sources the v1 ACF "intro" textarea
 * via the GraphQL `articleIntro` field.
 */
export function EssayIntro({ text, narrow = false }: Props) {
  const textClass = `${styles.text}${narrow ? " " + styles.narrow : ""}`;
  return (
    <section className={styles.intro}>
      <p className={textClass}>{text.trim()}</p>
    </section>
  );
}
