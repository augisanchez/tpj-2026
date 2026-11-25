import type { Metadata } from "next";
import localFont from "next/font/local";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { MotionRoot } from "@/components/MotionRoot";
import { NavTooltips } from "@/components/NavTooltips";
import { RouteAnnouncer } from "@/components/RouteAnnouncer";
import { SkipToContent } from "@/components/SkipToContent";
import "./globals.css";
import { SITE_NAME, DEFAULT_SHARE_IMAGE, SITE_URL } from "@/lib/seo";
import { CDN_BASE } from "@/lib/cdn";

const IMAGE_ORIGIN = (() => {
  try {
    return CDN_BASE ? new URL(CDN_BASE).origin : null;
  } catch {
    return null;
  }
})();

// Self-hosted (app/fonts) so builds never depend on Google Fonts being
// reachable. Oswald and Inter are variable files covering every weight.
const oswald = localFont({
  src: "./fonts/Oswald-var.woff2",
  weight: "500 700",
  display: "swap",
  variable: "--font-display",
});

const inter = localFont({
  src: "./fonts/Inter-var.woff2",
  weight: "400 700",
  display: "swap",
  variable: "--font-ui",
});

const sourceSerif = localFont({
  src: [
    { path: "./fonts/SourceSerif4-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/SourceSerif4-400-italic.woff2", weight: "400", style: "italic" },
  ],
  display: "swap",
  variable: "--font-serif",
  // The serif is reading text (bios, interview answers, quotes), not
  // first-screen type. Preloading both files on every page made them
  // compete with the first photo for bandwidth; they still load as soon
  // as the CSS asks for them.
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_NAME,
  description:
    "The Photographic Journal publishes photo essays, photographer interviews, and topical features that explore creativity and artistic intent.",
  // No canonical here: it would be inherited by every page without its
  // own (the 404 page pointed at the homepage). Pages set theirs.
  alternates: { types: { "application/rss+xml": [{ url: "/feed", title: SITE_NAME }] } },
  openGraph: { type: "website", siteName: SITE_NAME, images: [DEFAULT_SHARE_IMAGE] },
  twitter: { card: "summary_large_image", images: [DEFAULT_SHARE_IMAGE.url] },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${oswald.variable} ${inter.variable} ${sourceSerif.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Photos come from the image host: open that connection while the
            HTML is still parsing, so the first photo doesn't wait for a
            fresh DNS + TLS handshake (worst on slow mobile links). Images
            load without CORS, so no crossOrigin. */}
        {IMAGE_ORIGIN && <link rel="preconnect" href={IMAGE_ORIGIN} />}
        {/* Hand the connection hints (Accept-CH in next.config) to the
            image host. Chrome only sends them cross-origin with this meta;
            the Permissions-Policy header alone wasn't enough when tested.
            Cloudflare reads them for the slow-connection quality. */}
        {IMAGE_ORIGIN && (
          <meta
            httpEquiv="delegate-ch"
            content={["rtt", "downlink", "ect", "save-data"].map((h) => `${h} ${IMAGE_ORIGIN}`).join("; ")}
          />
        )}
        {/* Turn on reveal hidden-states before first paint; drop them if
            the app never hydrates so content can't stay invisible. */}
        {/* Head script: motion + image-fade flags (with a no-boot safety
            timer), and a fallback that swaps any failed edge-resized image
            (/cdn-cgi/image/...) for its original file, e.g. if Cloudflare's
            transformation quota is exhausted. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){var d=document.documentElement;document.addEventListener('error',function(e){var t=e.target;if(!t||t.tagName!=='IMG'||t.dataset.cdnFb)return;var s=t.currentSrc||t.src||'';if(s.indexOf('/cdn-cgi/image/')<0)return;t.dataset.cdnFb='1';t.removeAttribute('srcset');t.src=s.replace(/\\/cdn-cgi\\/image\\/[^\\/]+/,'')},true);})();",
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <SkipToContent />
        <Nav />
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
        <Footer />
        <MotionRoot />
        <NavTooltips />
        <RouteAnnouncer />
      </body>
    </html>
  );
}
