import { pageMetadata } from "@/lib/seo";
import { ShopProductCard } from "@/components/ShopProductCard";
import { SupportingPageBanner } from "@/components/SupportingPageBanner";
import styles from "@/components/ShopPage.module.css";

export const metadata = pageMetadata({
  title: "Store — The Photographic Journal",
  description: "Limited-edition books from The Photographic Journal.",
  path: "/shop",
});

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
    image: "/shop/residence-thumb.jpg",
    href: "/shop/residence",
    cta: "View book",
  },
];

export default function ShopPage() {
  return (
    <>
      <SupportingPageBanner title="Store" />

      <div className={styles.page}>
        <div className={styles.grid}>
          {PRODUCTS.map((product) => (
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
