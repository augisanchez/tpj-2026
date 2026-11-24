import type { Metadata } from "next";
import localFont from "next/font/local";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { MotionRoot } from "@/components/MotionRoot";
import { RouteAnnouncer } from "@/components/RouteAnnouncer";
import { SkipToContent } from "@/components/SkipToContent";
import "./globals.css";

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
  title: "The Photographic Journal",
  description: "Editorial photography. Essays, interviews, and features.",
  // Preview deployments (v2 subdomain) stay out of search results so
  // they don't compete with the live v1 site.
  ...(process.env.NEXT_PUBLIC_NOINDEX === "1" && {
    robots: { index: false, follow: false },
  }),
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
        {/* Turn on reveal hidden-states before first paint; drop them if
            the app never hydrates so content can't stay invisible. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){var d=document.documentElement;if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){d.classList.add('motion-on');setTimeout(function(){if(!d.classList.contains('motion-ready'))d.classList.remove('motion-on')},3000)}})();",
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
