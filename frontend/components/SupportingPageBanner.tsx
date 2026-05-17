import styles from "./SupportingPageBanner.module.css";

type Props = {
  title: string;
  /**
   * Supporting copy beneath the title. Pass one or more <p> elements.
   * If multiple paragraphs are provided, the last one renders at a
   * smaller scale so it reads as a closing tagline.
   */
  children?: React.ReactNode;
  /**
   * Optional class applied to the H1. Lets pages with longer words
   * (e.g. "Submissions") opt into a smaller font-size clamp without
   * shrinking the default treatment.
   */
  titleClassName?: string;
};

/**
 * Lime-banner page header used by the four supporting pages
 * (About, Submit, Contact, Shop). Edge-to-edge background with
 * an 880px content column centered on the viewport.
 */
export function SupportingPageBanner({
  title,
  children,
  titleClassName,
}: Props) {
  const titleClass = titleClassName
    ? `${styles.title} ${titleClassName}`
    : styles.title;
  return (
    <section className={styles.banner}>
      <div className={styles.bannerInner}>
        <h1 className={titleClass}>{title}</h1>
        {children && <div className={styles.support}>{children}</div>}
      </div>
    </section>
  );
}
