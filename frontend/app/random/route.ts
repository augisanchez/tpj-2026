import { randomStory } from "@/lib/queries/story-index";

// The story list is cached for an hour (lib/queries/story-index.ts); the
// pick runs on every request so each hit lands somewhere new.
export const dynamic = "force-dynamic";

const HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Robots-Tag": "noindex",
};

export async function GET(req: Request) {
  // Client-router requests (prefetches and soft navigations) get no
  // body. The router caches a redirect it followed, so every later
  // Shuffle click would replay the first pick. An empty, non-RSC answer
  // makes it fall back to a full page load of /random, which lands here
  // as a document request and picks fresh.
  if (req.headers.get("rsc") || req.headers.get("next-router-prefetch")) {
    return new Response(null, { status: 204, headers: HEADERS });
  }

  // Never send someone straight back to the story they shuffled from.
  const pick = await randomStory({ avoidPath: req.headers.get("referer") ?? "" });
  if (!pick) {
    return new Response(null, { status: 307, headers: { ...HEADERS, Location: "/explore" } });
  }

  return new Response(null, {
    status: 307,
    headers: { ...HEADERS, Location: `/${pick.type}/${pick.slug}` },
  });
}
