import Link from "next/link";
import { THEMES } from "@/lib/themes";
import styles from "@/components/ThemesIndex.module.css";

export const metadata = {
  title: "Themes — The Photographic Journal",
  description:
    "Eleven themes that thread through the TPJ archive.",
};

export default function ThemesIndexPage() {
  return (
    <>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>Theme</p>
        <h1 className={styles.title}>Themes</h1>
        <p className={styles.lede}>
          Eleven threads that recur across thirteen years of TPJ. Each is a
          question we keep asking. Each photograph in the archive answers in
          its own way.
        </p>
      </header>

      <div className={styles.list}>
        {THEMES.map((theme, i) => (
          <Link
            key={theme.slug}
            href={`/theme/${theme.slug}`}
            className={styles.row}
          >
            <span className={styles.rowNumber}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className={styles.rowText}>
              <span className={styles.rowName}>{theme.name}</span>
              <span className={styles.rowPrompt}>{theme.prompt}</span>
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
