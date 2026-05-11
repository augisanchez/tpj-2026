import { SupportingPageBanner } from "@/components/SupportingPageBanner";
import styles from "@/components/ShopPage.module.css";

export const metadata = {
  title: "Store — The Photographic Journal",
  description:
    "Limited-edition books and merchandise from The Photographic Journal.",
};

const PRODUCTS: {
  title: string;
  variant: string;
  image: string;
  href: string;
  cta?: string;
}[] = [
  {
    title: "Residence",
    variant: "Photobook by Kate Sweeney",
    image: "https://thephotographicjournal.com/store/images/residence-thumb.png",
    href: "https://thephotographicjournal.com/store/residence/",
    cta: "View book",
  },
  {
    title: "Light and Grain",
    variant: "Unisex classic crewneck sweatshirt",
    image:
      "https://thephotographicjournal.com/store/images/LightAndGrain-sweatshirt.jpg",
    href: "https://my-store-f1b979.creator-spring.com/listing/light-and-grain?product=345",
  },
  {
    title: "TPJ Beanie",
    variant: "Black",
    image: "https://thephotographicjournal.com/store/images/beanie.jpg",
    href: "https://my-store-f1b979.creator-spring.com/listing/tpj-beanie?product=2152",
  },
  {
    title: "Visual Storyteller — Light",
    variant: "Premium ring-spun cotton t-shirt",
    image:
      "https://thephotographicjournal.com/store/images/visual-tee-light.jpg",
    href: "https://my-store-f1b979.creator-spring.com/listing/visual-storyteller-light?product=46",
  },
  {
    title: "Visual Storyteller — Light",
    variant: "Unisex classic crewneck sweatshirt",
    image:
      "https://thephotographicjournal.com/store/images/visual-sweather-light.jpg",
    href: "https://my-store-f1b979.creator-spring.com/listing/visual-storyteller-light?product=345",
  },
  {
    title: "Visual Storyteller — Dark",
    variant: "Premium ring-spun cotton t-shirt",
    image: "https://thephotographicjournal.com/store/images/visual-tee-dark.jpg",
    href: "https://my-store-f1b979.creator-spring.com/listing/visual-storyteller-dark?product=46",
  },
  {
    title: "Visual Storyteller — Dark",
    variant: "Unisex classic crewneck sweatshirt",
    image:
      "https://thephotographicjournal.com/store/images/visual-sweater-dark.jpg",
    href: "https://my-store-f1b979.creator-spring.com/listing/visual-storyteller-dark?product=345",
  },
  {
    title: "TPJ Mug",
    variant: "Camping mug",
    image: "https://thephotographicjournal.com/store/images/visual-mug.jpg",
    href: "https://my-store-f1b979.creator-spring.com/listing/tpj-mug",
  },
  {
    title: "Visual Storyteller Cap — Dark",
    variant: "Dad cap",
    image:
      "https://thephotographicjournal.com/store/images/visual-cap-dark.jpg",
    href: "https://my-store-f1b979.creator-spring.com/listing/visual-storyteller-black-dad",
  },
  {
    title: "Visual Storyteller Cap — Light",
    variant: "Dad cap",
    image:
      "https://thephotographicjournal.com/store/images/visual-cap-light.jpg",
    href: "https://my-store-f1b979.creator-spring.com/listing/visual-storyteller-light-ca",
  },
];

export default function ShopPage() {
  return (
    <>
      <SupportingPageBanner title="Store">
        <p>
          Photobooks are sold directly through TPJ. Apparel and accessories
          are fulfilled by Creator Spring and ship worldwide.
        </p>
      </SupportingPageBanner>

      <main className={styles.page}>
        <div className={styles.grid}>
          {PRODUCTS.map((product) => {
            const isExternal = product.href.startsWith("http");
            return (
              <a
                key={`${product.title}-${product.variant}`}
                href={product.href}
                className={styles.card}
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noopener noreferrer" : undefined}
              >
                <div className={styles.cardImage}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={product.image} alt={product.title} />
                </div>
                <div className={styles.cardLabel}>
                  <h2 className={styles.cardTitle}>{product.title}</h2>
                  <p className={styles.cardVariant}>{product.variant}</p>
                </div>
                <p className={styles.cardCta}>
                  {product.cta ?? "Shop"}
                  <span className={styles.cardCtaArrow} aria-hidden="true">
                    {isExternal ? "↗" : "→"}
                  </span>
                </p>
              </a>
            );
          })}
        </div>
      </main>
    </>
  );
}
