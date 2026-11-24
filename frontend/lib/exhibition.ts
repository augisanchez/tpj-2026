/**
 * Exhibition helpers for article pages: number every photograph in the
 * prepared body HTML as a plate, give each one an anchor, and return the
 * list for the wall label count and the end-of-article checklist.
 *
 * Works on the output of prepareArticleBodyHtml (lib/media.ts), which
 * wraps every body <img> in exactly one `<span class="img-frame">`. No
 * extra CMS queries: everything comes from the HTML already fetched.
 */

export type Plate = {
  n: number;
  id: string;
  src: string;
  alt: string;
  width?: number;
  height?: number;
};

const FRAME_RE = /<span class="img-frame"([^>]*)>(<img\b[^>]*>)/gi;
const THUMB_WIDTH = 480;

function attr(tag: string, name: string): string | undefined {
  const m = new RegExp(`\\s${name}\\s*=\\s*(["'])(.*?)\\1`, "i").exec(tag);
  return m?.[2];
}

/** A small CDN rendition of a body image for the checklist strip. */
function thumbSrc(img: string): string {
  const src = attr(img, "src") ?? "";
  if (src.includes("/cdn-cgi/image/")) {
    return src.replace(/\bwidth=\d+/, `width=${THUMB_WIDTH}`);
  }
  // Without the CDN, take the smallest srcset candidate if there is one.
  const first = attr(img, "srcset")?.split(",")[0]?.trim().split(/\s+/)[0];
  return first || src;
}

export function hangPlates(html: string): { html: string; plates: Plate[] } {
  const plates: Plate[] = [];
  const out = html.replace(FRAME_RE, (_m, spanAttrs: string, img: string) => {
    const n = plates.length + 1;
    const id = `plate-${n}`;
    const w = Number(attr(img, "width")) || undefined;
    const h = Number(attr(img, "height")) || undefined;
    plates.push({
      n,
      id,
      src: thumbSrc(img),
      alt: (attr(img, "alt") ?? "").replace(/&quot;/g, '"'),
      width: w,
      height: h,
    });
    // Anchor target: focusable from script (tabindex -1), clear of the
    // sticky nav when reached by a plain hash jump.
    const style = /\sstyle="([^"]*)"/i.exec(spanAttrs);
    const rest = style ? spanAttrs.replace(style[0], "") : spanAttrs;
    const css = `${style ? style[1].replace(/;?$/, ";") : ""}scroll-margin-top:96px`;
    return `<span class="img-frame" id="${id}" tabindex="-1" style="${css}"${rest}>${img}`;
  });
  return { html: out, plates };
}
