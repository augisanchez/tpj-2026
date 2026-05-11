import Link from "next/link";
import { fetchRecentEssays } from "@/lib/queries/recent-essays";
import styles from "@/components/NotFoundPage.module.css";

// Force dynamic rendering so a different essay's hero is picked on each
// visit instead of caching one image into the static 404 page.
export const dynamic = "force-dynamic";

const QUIPS = [
  "Oops. You lost your way.",
  "There's nothing here. But there's plenty here →",
  "Wrong room. The light is still good.",
  "404. Probably a typo. Possibly fate.",
  "Roll of film, no negatives.",
  "Picture not in the archive.",
  "Off-frame. Try the homepage.",
];

export default async function NotFound() {
  const essays = await fetchRecentEssays(60);
  const pool = essays.filter((e) => e.featuredImage);
  const choice =
    pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null;
  const quip = QUIPS[Math.floor(Math.random() * QUIPS.length)];

  return (
    <Link href="/" className={styles.cover}>
      {choice?.featuredImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className={styles.bg}
          src={choice.featuredImage.src}
          alt={choice.featuredImage.alt}
        />
      )}
      <div className={styles.gradient} aria-hidden="true" />

      <div className={styles.content}>
        <p className={styles.eyebrow}>Error 404</p>
        <h1 className={styles.title}>Oops.</h1>
        <p className={styles.sub}>{quip}</p>
        <span className={styles.cta}>
          ← Back to the homepage
        </span>
      </div>

      {choice && (
        <p className={styles.credit}>
          Photograph: {choice.title}
        </p>
      )}
    </Link>
  );
}
