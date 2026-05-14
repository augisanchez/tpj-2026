import Link from "next/link";
import { ThemeThumbnail } from "@/components/ThemeThumbnail";
import { fetchEssaysByThemes } from "@/lib/queries/essays-by-theme";
import { THEMES } from "@/lib/themes";
import styles from "@/components/ThemesIndex.module.css";

export const metadata = {
  title: "Themes — The Photographic Journal",
  description:
    "Eleven themes that thread through the TPJ archive.",
};

export default async function ThemesIndexPage() {
  // Pull 4 tagged essays per theme for the composite thumbnail.
  // fetchEssaysByThemes runs all 11 queries in parallel; ~150ms typical.
  const themeGroups = await fetchEssaysByThemes(
    THEMES.map((t) => t.slug),
    4
  );

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

      <div className={styles.grid}>
        {THEMES.map((theme, i) => {
          const essays = themeGroups[theme.slug] ?? [];
          const images = essays
            .map((e) =>
              e.featuredImage
                ? { src: e.featuredImage.src, alt: e.featuredImage.alt }
                : null
            )
            .filter((img): img is { src: string; alt: string } => img !== null);

          return (
            <Link
              key={theme.slug}
              href={`/theme/${theme.slug}`}
              className={styles.card}
            >
              <ThemeThumbnail images={images} className={styles.cardThumb} />
              <div className={styles.cardText}>
                <p className={styles.cardNumber}>
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h2 className={styles.cardName}>{theme.name}</h2>
                <p className={styles.cardPrompt}>{theme.prompt}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
