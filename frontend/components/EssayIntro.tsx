import styles from "./EssayIntro.module.css";

type Props = {
  text: string;
};

/**
 * Editorial intro / lede displayed above the article body. Uses the
 * larger Inter Medium scale that matches the supporting page banners
 * and the Submit pitch heading. Sources the v1 ACF "intro" textarea
 * via the GraphQL `articleIntro` field.
 */
export function EssayIntro({ text }: Props) {
  return (
    <section className={styles.intro}>
      <p className={styles.text}>{text.trim()}</p>
    </section>
  );
}
