import styles from "./ThinPage.module.css";

type Props = {
  eyebrow?: string;
  title: string;
  children: React.ReactNode;
};

export function ThinPage({ eyebrow, title, children }: Props) {
  return (
    <main className={styles.page}>
      {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
      <h1 className={styles.title}>{title}</h1>
      <div className={styles.body}>{children}</div>
    </main>
  );
}
