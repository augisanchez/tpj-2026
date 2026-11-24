import { pageMetadata } from "@/lib/seo";
import { ShopProductCard } from "@/components/ShopProductCard";
import { SupportingPageBanner } from "@/components/SupportingPageBanner";
import styles from "@/components/ShopPage.module.css";

export const metadata = pageMetadata({
  title: "Store — The Photographic Journal",
  description: "Limited-edition books and merchandise from The Photographic Journal.",
  path: "/shop",
});

const PRODUCTS: {
  title: string;
  variant: string;
  image: string;
  href: string;
  cta?: string;
  /** Creator Spring closed the TPJ store (every listing returns 410 as of
   *  2026-11-24). Kept here so merch can return with new links. */
  available?: boolean;
}[] = [
  {
    title: "Residence",
    variant: "Photobook by Kate Sweeney",
    image: "/shop/residence-thumb.jpg",
    href: "/shop/residence",
    cta: "View book",
  },
  {
    title: "Light and Grain",
    variant: "Unisex classic crewneck sweatshirt",
    image:
      "/shop/LightAndGrain-sweatshirt.jpg",
    href: "https://my-store-f1b979.creator-spring.com/listing/light-and-grain?product=345",
    available: false,
  },
  {
    title: "TPJ Beanie",
    variant: "Black",
    image: "/shop/beanie.jpg",
    href: "https://my-store-f1b979.creator-spring.com/listing/tpj-beanie?product=2152",
    available: false,
  },
  {
    title: "Visual Storyteller — Light",
    variant: "Premium ring-spun cotton t-shirt",
    image:
      "/shop/visual-tee-light.jpg",
    href: "https://my-store-f1b979.creator-spring.com/listing/visual-storyteller-light?product=46",
    available: false,
  },
  {
    title: "Visual Storyteller — Light",
    variant: "Unisex classic crewneck sweatshirt",
    image:
      "/shop/visual-sweather-light.jpg",
    href: "https://my-store-f1b979.creator-spring.com/listing/visual-storyteller-light?product=345",
    available: false,
  },
  {
    title: "Visual Storyteller — Dark",
    variant: "Premium ring-spun cotton t-shirt",
    image: "/shop/visual-tee-dark.jpg",
    href: "https://my-store-f1b979.creator-spring.com/listing/visual-storyteller-dark?product=46",
    available: false,
  },
  {
    title: "Visual Storyteller — Dark",
    variant: "Unisex classic crewneck sweatshirt",
    image:
      "/shop/visual-sweater-dark.jpg",
    href: "https://my-store-f1b979.creator-spring.com/listing/visual-storyteller-dark?product=345",
    available: false,
  },
  {
    title: "TPJ Mug",
    variant: "Camping mug",
    image: "/shop/visual-mug.jpg",
    href: "https://my-store-f1b979.creator-spring.com/listing/tpj-mug",
    available: false,
  },
  {
    title: "Visual Storyteller Cap — Dark",
    variant: "Dad cap",
    image:
      "/shop/visual-cap-dark.jpg",
    href: "https://my-store-f1b979.creator-spring.com/listing/visual-storyteller-black-dad",
    available: false,
  },
  {
    title: "Visual Storyteller Cap — Light",
    variant: "Dad cap",
    image:
      "/shop/visual-cap-light.jpg",
    href: "https://my-store-f1b979.creator-spring.com/listing/visual-storyteller-light-ca",
    available: false,
  },
];

export default function ShopPage() {
  return (
    <>
      <SupportingPageBanner title="Store" />

      <div className={styles.page}>
        <div className={styles.grid}>
          {PRODUCTS.filter((p) => p.available !== false).map(({ available: _a, ...product }) => (
            <ShopProductCard
              key={`${product.title}-${product.variant}`}
              {...product}
            />
          ))}
        </div>
      </div>
    </>
  );
}
