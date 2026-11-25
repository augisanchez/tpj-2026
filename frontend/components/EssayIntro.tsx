import styles from "./EssayIntro.module.css";

type Props = {
  text?: string | null;
  /** Editing note ("This interview has been edited for length and
   *  clarity."), set under the intro in its own small type. */
  note?: string | null;
};

/**
 * Editorial intro / lede displayed above the article body. Uses the
 * larger Inter Medium scale that matches the supporting page banners
 * and the Submit pitch heading. Sources the v1 ACF "intro" textarea
 * via the GraphQL `articleIntro` field.
 */
export function EssayIntro({ text, note }: Props) {
  if (!text && !note) return null;
  return (
    <section className={styles.intro}>
      {text && <p className={styles.text} data-reveal>{text.trim()}</p>}
      {note && <p className={styles.note} data-reveal>{note}</p>}
    </section>
  );
}
