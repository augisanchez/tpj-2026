import { notFound } from "next/navigation";
import { ArticleCard } from "@/components/ArticleCard";
import { EmptyState } from "@/components/EmptyState";
import { PhotographerAvatar } from "@/components/PhotographerAvatar";
import { fetchPhotographerArticles } from "@/lib/queries/photographer-articles";
import { fetchPhotographerBySlug } from "@/lib/queries/photographer-by-slug";
import styles from "@/components/PhotographerProfile.module.css";

const TYPE_LABEL = {
  essay: "Photo Essay",
  interview: "Interview",
  feature: "Feature",
} as const;

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function PhotographerPage({ params }: Props) {
  const { slug } = await params;

  const [photographer, articles] = await Promise.all([
    fetchPhotographerBySlug(slug),
    fetchPhotographerArticles(slug),
  ]);

  if (!photographer) notFound();

  const totalArticles = articles.length;
  // Hero cover is the photographer themselves: their portrait, or an
  // initials avatar fallback when we have no image. Same source used on
  // the /photographers index card. Their work appears below in the
  // articles grid.
  // Earliest article year for the "since YYYY" line. Articles are sorted
  // newest first, so the last entry is oldest.
  const startYear =
    articles.length > 0
      ? new Date(articles[articles.length - 1].date).getFullYear()
      : null;

  // Meta line: location · article count line. Location reads from
  // tpj_location postmeta (exposed as `location` on Photographer).
  const metaSegments: string[] = [];
  if (photographer.location) {
    metaSegments.push(photographer.location);
  }
  if (totalArticles > 0) {
    metaSegments.push(
      `${totalArticles} ${
        totalArticles === 1 ? "article" : "articles"
      } in TPJ${startYear ? ` since ${startYear}` : ""}`
    );
  }
  const metaLine = metaSegments.join("  ·  ");

  return (
    <div className={styles.page}>
      <section className={styles.profile}>
        <div className={styles.cover}>
          <PhotographerAvatar
            name={photographer.name}
            portrait={photographer.portrait ?? undefined}
            className={styles.coverImage}
          />
        </div>

        <div className={styles.meta}>
          <div className={styles.identity}>
            <p className={styles.eyebrow}>Photographer</p>
            <h1 className={styles.name}>{photographer.name}</h1>
            {metaLine && <p className={styles.locationCount}>{metaLine}</p>}
            {photographer.representedBy && (
              <p className={styles.representedBy}>
                Represented by {photographer.representedBy}
              </p>
            )}
          </div>

          <div className={styles.bioColumn}>
            {photographer.bio && (
              <p className={styles.bio}>{photographer.bio}</p>
            )}
            {photographer.socials.length > 0 && (
              <div className={styles.socials}>
                {photographer.socials.map((s) => (
                  <a
                    key={s.label}
                    className={styles.social}
                    href={s.href}
                    target={s.external ? "_blank" : undefined}
                    rel={s.external ? "noopener noreferrer" : undefined}
                  >
                    {s.label}
                    {s.external ? " ↗" : ""}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className={styles.articles}>
        {articles.length > 0 ? (
          <>
            <p className={styles.articlesHead}>
              {totalArticles}{" "}
              {totalArticles === 1 ? "article" : "articles"}
            </p>
            <div className={styles.grid}>
              {articles.map((a) => (
                <ArticleCard
                  key={a.id}
                  variant="5up"
                  article={{
                    title: a.title,
                    date: a.date,
                    href: `/${a.contentType}/${a.slug}`,
                    contentTypeLabel: TYPE_LABEL[a.contentType],
                    featuredImage: a.featuredImage ?? undefined,
                  }}
                />
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            heading={`No articles by ${photographer.name} in the archive yet.`}
            note="Check back after the next issue ships."
          />
        )}
      </section>
    </div>
  );
}
