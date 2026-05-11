import styles from "./ContentTypeChip.module.css";

export type ContentTypeChipSize = "small" | "medium" | "large";

type Props = {
  label: string;
  size?: ContentTypeChipSize;
  className?: string;
};

export function ContentTypeChip({ label, size = "small", className }: Props) {
  return (
    <span className={`${styles.chip} ${styles[size]}${className ? " " + className : ""}`}>
      {label}
    </span>
  );
}
