import { fetchSearchResults } from "@/lib/queries/search";

/**
 * Full-text search (words inside stories), for the /search page's
 * "Mentioned in" list. Fetched by the browser after the page is up, so
 * the page never waits on WordPress. Vercel's edge caches each query for
 * an hour; WordPress saves refresh the data underneath (lib/api.ts).
 */
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().toLowerCase().slice(0, 100);
  if (!q) return Response.json({ photographers: [], items: [] });
  try {
    const data = await fetchSearchResults(q);
    return Response.json(data, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch {
    return Response.json({ error: "search unavailable" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
