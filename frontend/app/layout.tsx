import type { Metadata } from "next";
import { Oswald, Inter, Source_Serif_4 } from "next/font/google";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { MotionRoot } from "@/components/MotionRoot";
import { RouteAnnouncer } from "@/components/RouteAnnouncer";
import { SkipToContent } from "@/components/SkipToContent";
import "./globals.css";

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["500", "700"],
  display: "swap",
  variable: "--font-display",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-ui",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
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
