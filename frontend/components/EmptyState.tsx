import styles from "./EmptyState.module.css";

type Props = {
  heading: string;
  note?: string;
};

export function EmptyState({ heading, note }: Props) {
  return (
    <div className={styles.empty}>
      <p className={styles.heading}>{heading}</p>
      {note && <p className={styles.note}>{note}</p>}
    </div>
  );
}
