import styles from "./SupportingPageBanner.module.css";

type Props = {
  title: string;
  /**
   * Supporting copy beneath the title. Pass one or more <p> elements.
   * If multiple paragraphs are provided, the last one renders at a
   * smaller scale so it reads as a closing tagline.
   */
  children?: React.ReactNode;
};

/**
 * Lime-banner page header used by the four supporting pages
 * (About, Submit, Contact, Shop). Edge-to-edge background with
 * an 880px content column centered on the viewport.
 */
export function SupportingPageBanner({ title, children }: Props) {
  return (
    <section className={styles.banner}>
      <div className={styles.bannerInner}>
        <h1 className={styles.title}>{title}</h1>
        {children && <div className={styles.support}>{children}</div>}
      </div>
    </section>
  );
}
