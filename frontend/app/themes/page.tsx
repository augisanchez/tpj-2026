import Link from "next/link";
import { ThemeThumbnail } from "@/components/ThemeThumbnail";
import { fetchEssaysByThemes } from "@/lib/queries/essays-by-theme";
import { fetchThemeCounts } from "@/lib/queries/theme-counts";
import { THEMES } from "@/lib/themes";
import styles from "@/components/ThemesIndex.module.css";

export const metadata = {
  title: "Themes — The Photographic Journal",
  description:
    "Eleven themes that thread through the TPJ archive.",
};

export default async function ThemesIndexPage() {
  // Pull 4 tagged essays per theme for the composite thumbnail +
  // per-theme article counts for the collection-size label.
  const [themeGroups, themeCounts] = await Promise.all([
    fetchEssaysByThemes(THEMES.map((t) => t.slug), 4),
    fetchThemeCounts(),
  ]);

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
        {THEMES.map((theme) => {
          const essays = themeGroups[theme.slug] ?? [];
          const images = essays
            .map((e) =>
              e.featuredImage
                ? { src: e.featuredImage.src, alt: e.featuredImage.alt }
                : null
            )
            .filter((img): img is { src: string; alt: string } => img !== null);
          const count = themeCounts[theme.slug];

          return (
            <Link
              key={theme.slug}
              href={`/theme/${theme.slug}`}
              className={styles.card}
            >
              <ThemeThumbnail images={images} className={styles.cardThumb} />
              <div className={styles.cardText}>
                {count != null && (
                  <p className={styles.cardCount}>
                    {count} {count === 1 ? "article" : "articles"}
                  </p>
                )}
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
