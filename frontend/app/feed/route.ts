import { articleHref, fetchRecentArticles } from "@/lib/queries/recent-articles";
import { cdnImageUrl } from "@/lib/cdn";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

// Rebuilt with the rest of the site (hourly, or when WordPress saves).
export const revalidate = 3600;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** WPGraphQL ids are base64("post:123"). The old WordPress feed used
 *  ?p=123 as each item's GUID; keeping it stops readers re-showing items. */
function wpGuid(id: string): string | null {
  try {
    const m = /:(\d+)$/.exec(Buffer.from(id, "base64").toString("utf8"));
    return m ? `${SITE_URL}/?p=${m[1]}` : null;
  } catch {
    return null;
  }
}

/** RSS 2.0: the latest 30 essays, interviews and features. */
export async function GET() {
  const items = await fetchRecentArticles(30);
  const body = items
    .map((a) => {
      const link = `${SITE_URL}${articleHref(a)}`;
      const guid = wpGuid(a.id);
      const img = a.featuredImage?.src
        ? cdnImageUrl(a.featuredImage.src, { width: 1200, quality: 80, format: "jpeg" })
        : null;
      return [
        "    <item>",
        `      <title>${esc(a.title)}</title>`,
        `      <link>${link}</link>`,
        guid
          ? `      <guid isPermaLink="false">${guid}</guid>`
          : `      <guid isPermaLink="true">${link}</guid>`,
        `      <pubDate>${new Date(a.date).toUTCString()}</pubDate>`,
        a.photographerName ? `      <dc:creator>${esc(a.photographerName)}</dc:creator>` : "",
        a.excerpt ? `      <description>${esc(a.excerpt)}</description>` : "",
        img ? `      <media:content url="${esc(img)}" medium="image" />` : "",
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${esc(SITE_NAME)}</title>
    <link>${SITE_URL}</link>
    <atom:link href="${SITE_URL}/feed" rel="self" type="application/rss+xml" />
    <description>Photo essays, photographer interviews, and topical features that explore creativity and artistic intent.</description>
    <language>en</language>
${body}
  </channel>
</rss>
`;
  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
