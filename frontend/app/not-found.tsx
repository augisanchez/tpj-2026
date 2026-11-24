import Link from "next/link";
import { randomStory } from "@/lib/queries/story-index";
import { NOT_FOUND_META } from "@/lib/seo";
import { Icon } from "@/components/Icon";
import { TpjImage } from "@/components/TpjImage";
import styles from "@/components/NotFoundPage.module.css";

// Dynamic so each visit hangs a different photograph. The story list
// itself is cached for an hour, so this costs the CMS nothing.
export const dynamic = "force-dynamic";

// Next adds the noindex robots tag itself; no canonical is inherited.
export const metadata = NOT_FOUND_META;

export default async function NotFound() {
  const pick = await randomStory({ withImage: true });

  return (
    <section className={styles.page}>
      <div className={styles.text}>
        <p className={styles.eyebrow}>Error 404</p>
        <h1 className={styles.title} data-reveal="lines">
          This gallery is closed for installation
        </h1>
        <p className={styles.sub} data-reveal>
          Whatever hung here has come down. The rest of the collection is open.
        </p>
        <div className={styles.actions} data-reveal>
          <Link href="/" className={styles.primary}>
            See what&rsquo;s on view
          </Link>
          <Link href="/random" prefetch={false} className={styles.secondary}>
            <Icon name="shuffle" inline className={styles.icon} />
            Show me something
          </Link>
        </div>
      </div>

      {pick && (
        <figure className={styles.plate} data-reveal>
          <Link href={`/${pick.type}/${pick.slug}`} className={styles.frame} tabIndex={-1} aria-hidden="true">
            <TpjImage
              className={styles.img}
              src={pick.image}
              alt=""
              sizes="(min-width: 900px) 34vw, 100vw"
              widths={[480, 768, 1024, 1440]}
            />
          </Link>
          <figcaption className={styles.caption}>
            <span className={styles.no}>{`No. ${pick.no}`}</span>{" "}
            <Link href={`/${pick.type}/${pick.slug}`}>{pick.title}</Link>
            {pick.photographer ? `, ${pick.photographer}` : ""}
          </figcaption>
        </figure>
      )}
    </section>
  );
}
