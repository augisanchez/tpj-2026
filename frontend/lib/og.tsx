import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { cdnImageUrl } from "./cdn";

/** Share images: the 1.91:1 crop Facebook, LinkedIn and X all use. */
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const SURFACE = "#cff26d"; // --acid, the footer and band green
const INK = "#111111"; // --acid-ink
const GAP = "#111111";

// Static, Latin-subset instances of the site's variable fonts (the image
// renderer reads TTF, not WOFF2). Made from app/fonts with fontTools.
async function fonts() {
  const dir = join(process.cwd(), "assets/og");
  const [oswald, inter, mark] = await Promise.all([
    readFile(join(dir, "Oswald-Bold.ttf")),
    readFile(join(dir, "Inter-Medium.ttf")),
    readFile(join(dir, "tpj_black.svg"), "utf8"),
  ]);
  return {
    fonts: [
      { name: "Oswald", data: oswald, weight: 700 as const, style: "normal" as const },
      { name: "Inter", data: inter, weight: 500 as const, style: "normal" as const },
    ],
    mark: `data:image/svg+xml;base64,${Buffer.from(mark).toString("base64")}`,
  };
}

/**
 * Index pages (Explore, Artists, Themes...): the page name in the display
 * face on the surface green, one line under it, the TPJ mark in the corner.
 */
export async function indexCard(title: string, line: string) {
  const { fonts: f, mark } = await fonts();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: SURFACE,
          color: INK,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- rendered by the OG image renderer, not the browser */}
        <img src={mark} alt="" width={116} height={65} />
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {/* Line height leaves room for descenders (p, g, y) above the line below. */}
          <div style={{ fontFamily: "Oswald", fontSize: 196, lineHeight: 1.1, letterSpacing: -4 }}>{title}</div>
          <div style={{ fontFamily: "Inter", fontSize: 36, lineHeight: 1.3, maxWidth: 940 }}>{line}</div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: f },
  );
}

type Img = { src: string };

/**
 * Artist pages: their work carries the preview, never the small portrait
 * alone. Two or more stories make a collage (work top left, portrait top
 * right, more work below); one story is its cover; a portrait alone is
 * centred on the face; nobody's photos fall back to a name card.
 */
export async function artistImage(name: string, work: Img[], portrait: Img | null) {
  const url = (src: string, w: number, h: number) =>
    cdnImageUrl(src, { width: w, height: h, fit: "cover", gravity: "face", quality: 80, format: "jpeg" }) ?? src;

  let cells: { src: string; w: number; h: number }[] = [];
  if (work.length >= 2) {
    const picks = portrait ? [work[0], portrait, ...work.slice(1, 3)] : work.slice(0, 4);
    if (picks.length >= 4) {
      cells = picks.slice(0, 4).map((p) => ({ src: p.src, w: 598, h: 313 }));
    } else {
      // Three: two across the top, one across the bottom.
      cells = [
        { src: picks[0].src, w: 598, h: 313 },
        { src: picks[1].src, w: 598, h: 313 },
        { src: picks[2]?.src ?? picks[0].src, w: 1200, h: 313 },
      ];
    }
  } else if (work.length === 1 || portrait) {
    cells = [{ src: (work[0] ?? portrait)!.src, w: 1200, h: 630 }];
  } else {
    return indexCard(name, "Photographs and stories in The Photographic Journal.");
  }

  const { fonts: f } = await fonts();
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexWrap: "wrap", gap: 4, background: GAP }}>
        {cells.map((c, i) => (
          // eslint-disable-next-line @next/next/no-img-element -- rendered by the OG image renderer, not the browser
          <img
            key={i}
            src={url(c.src, c.w, c.h)}
            alt=""
            width={c.w}
            height={c.h}
            style={{ objectFit: "cover", objectPosition: !work.length ? "50% 22%" : "50% 50%" }}
          />
        ))}
      </div>
    ),
    { ...OG_SIZE, fonts: f },
  );
}
