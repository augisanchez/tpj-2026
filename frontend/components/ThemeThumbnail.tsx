import { TpjImage } from "./TpjImage";
import styles from "./ThemeThumbnail.module.css";

type ThumbImage = { src: string; alt: string };

type Props = {
  images: ThumbImage[];
  className?: string;
  /**
   * When true, fill the parent's box instead of enforcing a 1:1
   * aspect ratio internally. Used when embedding inside a card
   * whose imageWrapper already constrains the shape.
   */
  fillParent?: boolean;
};

/**
 * Spotify-style composite thumbnail for theme cards. Renders a 2×2
 * grid of up to 4 article images so the theme reads as a
 * collection at a glance rather than a single representative image.
 *
 * Degrades gracefully when fewer than 4 images are available:
 *   - 4 images → 2×2 grid (standard)
 *   - 3 images → top row 2 + bottom row 1 (stretched)
 *   - 2 images → side-by-side
 *   - 1 image  → single full-frame
 *   - 0 images → neutral placeholder
 *
 * Pairs with TpjImage so the eventual Cloudflare Image Resizing
 * cutover transparently picks up responsive srcsets.
 */
export function ThemeThumbnail({ images, className, fillParent = false }: Props) {
  const cells = images.slice(0, 4);
  const variantClass =
    styles[`count${cells.length}` as keyof typeof styles] ?? "";
  const fillClass = fillParent ? " " + styles.fill : "";
  const wrapperClass = `${styles.grid} ${variantClass}${fillClass}${className ? " " + className : ""}`;

  if (cells.length === 0) {
    return <div className={`${styles.grid}${fillClass} ${styles.empty}${className ? " " + className : ""}`} />;
  }

  return (
    <div className={wrapperClass} aria-hidden="true">
      {cells.map((img, i) => (
        <div key={i} className={styles.cell}>
          <TpjImage
            src={img.src}
            alt=""
            sizes="(min-width: 1024px) 25vw, 50vw"
            className={styles.image}
          />
        </div>
      ))}
    </div>
  );
}
