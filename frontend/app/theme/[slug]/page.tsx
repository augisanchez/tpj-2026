import { notFound } from "next/navigation";
import { ArticleCard } from "@/components/ArticleCard";
import { EmptyState } from "@/components/EmptyState";
import { THEMES } from "@/lib/themes";
import { fetchRecentEssays } from "@/lib/queries/recent-essays";
import styles from "@/components/ThemePage.module.css";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return THEMES.map((t) => ({ slug: t.slug }));
}

export default async function ThemePage({ params }: Props) {
  const { slug } = await params;
  const theme = THEMES.find((t) => t.slug === slug);
  if (!theme) notFound();

  // Until AI theme tagging runs (Build Plan Step 12), each theme page
  // shows the same recent-essays feed. Filter by tpj-theme term once
  // tagging is in place.
  const essays = await fetchRecentEssays(12);

  return (
    <>
      <header className={styles.banner}>
        <p className={styles.eyebrow}>Theme</p>
        <h1 className={styles.name}>{theme.name}</h1>
        <p className={styles.prompt}>{theme.prompt}</p>
        <p className={styles.count}>{essays.length} articles</p>
      </header>

      {essays.length === 0 ? (
        <EmptyState
          heading={`Nothing has been tagged ${theme.name} yet.`}
          note="Editorial review in progress."
        />
      ) : (
        <section className={styles.grid}>
          {essays.map((essay) => (
            <ArticleCard
              key={essay.id}
              variant="5up"
              article={{
                title: essay.title,
                date: essay.date,
                href: `/essay/${essay.slug}`,
                contentTypeLabel: "Photo Essay",
                featuredImage: essay.featuredImage ?? undefined,
              }}
            />
          ))}
        </section>
      )}
    </>
  );
}
