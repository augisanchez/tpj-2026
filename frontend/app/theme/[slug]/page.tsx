import { NOT_FOUND_META } from "@/lib/seo";
import { notFound } from "next/navigation";
import { ArticleCard } from "@/components/ArticleCard";
import { EmptyState } from "@/components/EmptyState";
import { THEMES } from "@/lib/themes";
import { fetchExplore } from "@/lib/queries/explore";
import styles from "@/components/ThemePage.module.css";
import type { Metadata } from "next";
import { describe, pageMetadata } from "@/lib/seo";
import { TYPE_LABELS } from "@/lib/content-types";

const TYPE_LABEL = TYPE_LABELS;

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return THEMES.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const theme = THEMES.find((t) => t.slug === slug);
  if (!theme) return NOT_FOUND_META;
  // Share image: the newest piece in the theme with a cover.
  const cover = (await fetchExplore(1000).catch(() => []))
    .find((i) => i.themes.includes(theme.slug) && i.featuredImage)?.featuredImage;
  return pageMetadata({
    title: `${theme.name} — The Photographic Journal`,
    description: theme.prompt,
    path: `/theme/${theme.slug}`,
    image: cover ?? null,
  });
}

export default async function ThemePage({ params }: Props) {
  const { slug } = await params;
  const theme = THEMES.find((t) => t.slug === slug);
  if (!theme) notFound();

  // Every article tagged with this theme, all types, newest first. Built
  // from the cached Explore list (one archive fetch shared site-wide).
  const items = (await fetchExplore(1000)).filter((i) => i.themes.includes(slug));

  return (
    <>
      <header className={styles.banner}>
        <p className={styles.eyebrow}>Theme</p>
        <h1 className={styles.name} data-reveal="lines">{theme.name}</h1>
        <p className={styles.prompt} data-reveal>{theme.prompt}</p>
        <p className={styles.count}>{items.length} {items.length === 1 ? "story" : "stories"}</p>
      </header>

      {items.length === 0 ? (
        <EmptyState
          heading={`Nothing has been tagged ${theme.name} yet.`}
          note="Editorial review in progress."
        />
      ) : (
        <section className={styles.grid} data-reveal-children>
          {items.map((item) => (
            <ArticleCard
              key={item.id}
              variant="5up"
              article={{
                title: item.title,
                date: item.date,
                href: `/${item.contentType}/${item.slug}`,
                contentTypeLabel: TYPE_LABEL[item.contentType],
                featuredImage: item.featuredImage ?? undefined,
              }}
            />
          ))}
        </section>
      )}
    </>
  );
}
