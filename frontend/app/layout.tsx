import type { Metadata } from "next";
import { currentSeason } from "@/lib/season";
import localFont from "next/font/local";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { MotionRoot } from "@/components/MotionRoot";
import { RouteAnnouncer } from "@/components/RouteAnnouncer";
import { SkipToContent } from "@/components/SkipToContent";
import "./globals.css";
import { SITE_NAME, DEFAULT_SHARE_IMAGE, SITE_URL } from "@/lib/seo";

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
      data-season={currentSeason()}
      className={`${oswald.variable} ${inter.variable} ${sourceSerif.variable}`}
      suppressHydrationWarning
    >
      <head>
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
        <RouteAnnouncer />
      </body>
    </html>
  );
}
