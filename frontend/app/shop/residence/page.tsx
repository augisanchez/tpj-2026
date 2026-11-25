import Link from "next/link";
import { AboutPhotographerSection } from "@/components/AboutPhotographerSection";
import { ContentTypeChip } from "@/components/ContentTypeChip";
import { JsonLd } from "@/components/JsonLd";
import { TpjImage } from "@/components/TpjImage";
import { fetchPhotographerArticles } from "@/lib/queries/photographer-articles";
import { fetchPhotographerBySlug } from "@/lib/queries/photographer-by-slug";
import { breadcrumbJsonLd, pageMetadata, SITE_URL } from "@/lib/seo";
import styles from "@/components/BookPage.module.css";

// Copy carried over verbatim from the old storefront
// (thephotographicjournal.com/store/residence/). Sold on Lulu.
const BOOK = {
  title: "Residence",
  photographer: { name: "Kate Sweeney", slug: "kate-sweeney" },
  pages: 158,
  format: "Hardcover",
  published: 2023,
  description:
    "Kate Sweeney was TPJ’s Photographer-in-Residence from 2016-2019. What follows is Kate’s original photo essays re-edited and expanded to provide a fuller compendium of Kate’s three year photographic exploration.",
  buyUrl: "https://www.lulu.com/shop/kate-sweeney/residence/hardcover/product-8v9vqm.html",
  note: "Please allow 3 to 4 weeks for delivery. Books are print-on-demand.",
  photosNote: "Pre-production book used for photos. Expect slight variations from final production.",
  cover: { src: "/shop/residence-thumb.jpg", width: 1200, height: 1200 },
  photos: ["001", "002", "003", "004"],
};

export const revalidate = 3600;

export const metadata = pageMetadata({
  title: "Residence, a photobook by Kate Sweeney — The Photographic Journal",
  description: BOOK.description,
  path: "/shop/residence",
  image: null,
});

export default async function ResidencePage() {
  const [kate, work] = await Promise.all([
    fetchPhotographerBySlug(BOOK.photographer.slug).catch(() => null),
    fetchPhotographerArticles(BOOK.photographer.slug).catch(() => null),
  ]);

  const specs: [string, React.ReactNode][] = [
    [
      "Photographer",
      <Link key="p" href={`/artist/${BOOK.photographer.slug}`} className={styles.specLink}>
        {BOOK.photographer.name}
      </Link>,
    ],
    ["Pages", BOOK.pages],
    ["Format", BOOK.format],
    ["Published", BOOK.published],
  ];

  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Book",
            name: BOOK.title,
            author: { "@type": "Person", name: BOOK.photographer.name, url: `${SITE_URL}/artist/${BOOK.photographer.slug}` },
            numberOfPages: BOOK.pages,
            bookFormat: "https://schema.org/Hardcover",
            datePublished: String(BOOK.published),
            image: `${SITE_URL}${BOOK.cover.src}`,
            description: BOOK.description,
            publisher: { "@type": "Organization", name: "The Photographic Journal" },
            offers: { "@type": "Offer", url: BOOK.buyUrl, availability: "https://schema.org/InStock" },
          },
          breadcrumbJsonLd([
            { name: "Store", path: "/shop" },
            { name: BOOK.title, path: "/shop/residence" },
          ]),
        ]}
      />

      <div className={styles.page}>
        <div className={styles.top}>
          <figure className={styles.cover} data-reveal="wipe">
            <TpjImage
              src={BOOK.cover.src}
              alt={`${BOOK.title} by ${BOOK.photographer.name}, cover`}
              sizes="(min-width: 900px) 50vw, 100vw"
              width={BOOK.cover.width}
              height={BOOK.cover.height}
              priority
            />
          </figure>

          <div className={styles.details}>
            <div data-reveal>
              <ContentTypeChip label="Photobook" size="large" />
            </div>
            <h1 className={styles.title} data-reveal="lines">{BOOK.title}</h1>

            <dl className={styles.specs} data-reveal>
              {specs.map(([label, value]) => (
                <div key={label} className={styles.spec}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>

            <p className={styles.description} data-reveal>{BOOK.description}</p>

            <div className={styles.buy} data-reveal>
              <a href={BOOK.buyUrl} target="_blank" rel="noopener noreferrer" className={styles.button}>
                Buy now
                <span aria-hidden="true">↗</span>
              </a>
              <p className={styles.note}>{BOOK.note}</p>
            </div>
          </div>
        </div>

        <section className={styles.gallery} aria-label="Inside the book">
          <p className={styles.photosNote} data-reveal>{BOOK.photosNote}</p>
          <div className={styles.grid} data-reveal-children>
            {BOOK.photos.map((n, i) => (
              <figure key={n} className={styles.photo} data-pz>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="pz-media"
                  src={`/shop/residence/${n}-2000.jpg`}
                  srcSet={`/shop/residence/${n}-1000.jpg 1000w, /shop/residence/${n}-2000.jpg 2000w`}
                  sizes="(min-width: 768px) 45vw, 100vw"
                  alt={`${BOOK.title}, spread ${i + 1}`}
                  width={2000}
                  height={1600}
                  loading="lazy"
                  decoding="async"
                  data-fade=""
                />
              </figure>
            ))}
          </div>
        </section>
      </div>

      {kate && (
        <AboutPhotographerSection
          photographer={{
            name: kate.name,
            slug: kate.slug,
            articleCount: work?.articles.length ?? 0,
            portrait: kate.portrait ?? undefined,
          }}
        />
      )}
    </>
  );
}
