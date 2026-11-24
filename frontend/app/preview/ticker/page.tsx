import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Home from "@/app/page";
import { Ticker, type TickerItem } from "@/components/Ticker";
import { accentFor, ACCENT_COUNT, todayKey } from "@/lib/accent";
import { articleHref, fetchRecentArticles } from "@/lib/queries/recent-articles";

/**
 * LOCAL-ONLY preview: the homepage with a "Now / Next" ticker under the
 * header, for the client to judge before deciding. 404s in production
 * and on any Vercel deployment.
 *
 *   /preview/ticker              loud band (accent color, rotates daily)
 *   /preview/ticker?style=quiet  quiet band (text on page bg, hairlines)
 *   ?font=inter|oswald           compare typefaces on the loud band
 *   ?accent=0..4                 pin an accent color on the loud band
 */
export const metadata: Metadata = {
  title: "Ticker preview",
  robots: { index: false },
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function TickerPreview({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) notFound();

  const params = await searchParams;
  const variant = first(params.style) === "quiet" ? "quiet" : "loud";
  const font = first(params.font) === "inter" ? "ui" : "display";
  const accentParam = Number(first(params.accent));
  const accent =
    Number.isInteger(accentParam) && accentParam >= 0 && accentParam < ACCENT_COUNT
      ? String(accentParam)
      : accentFor(todayKey());

  // Same call the homepage makes, so it hits the same cached responses.
  const articles = await fetchRecentArticles(15).catch(() => []);
  const items: TickerItem[] = articles.slice(0, 10).map((a) => ({
    href: articleHref(a),
    title: a.title,
    photographer: a.photographerName,
  }));

  return (
    <>
      <Ticker items={items} variant={variant} font={font} accent={accent} />
      <Home />
    </>
  );
}
