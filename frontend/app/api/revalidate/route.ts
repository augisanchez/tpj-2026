import { revalidatePath } from "next/cache";
import { after } from "next/server";

// Room for the follow-up visits below (up to 20 pages, two at a time).
export const maxDuration = 60;

/**
 * WordPress calls this after an article or photographer is saved
 * (inc/editor-experience.php → tpj_request_revalidate) so changes show
 * on the site right away instead of within the one-hour cache window.
 */
export async function POST(req: Request) {
  const secret = process.env.TPJ_REVALIDATE_SECRET;
  if (!secret || req.headers.get("x-tpj-secret") !== secret) {
    return Response.json({ ok: false }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { paths?: unknown };
  const paths = Array.isArray(body.paths)
    ? body.paths.filter((p): p is string => typeof p === "string" && p.startsWith("/")).slice(0, 20)
    : [];
  // WordPress still sends the old people paths; refresh the new ones.
  const mapped = paths.flatMap((p) =>
    p === "/photographers" ? [p, "/artists"]
      : p.startsWith("/photographer/") ? [p, "/artist/" + p.slice("/photographer/".length)]
      : [p],
  );
  for (const p of mapped) revalidatePath(p);
  // Any save can change a title, credit or cover in the quick-search index.
  if (mapped.length) revalidatePath("/api/search-index");

  // Then visit each page once, after answering WordPress, so the rebuild
  // happens now instead of on the first reader's visit. A newly published
  // story is ready before anyone opens it. Two at a time: small CMS.
  const origin = new URL(req.url).origin;
  const pages = mapped.filter((p) => !p.startsWith("/api/"));
  after(async () => {
    const queue = [...pages];
    const visit = async () => {
      for (let p = queue.shift(); p; p = queue.shift()) {
        await fetch(origin + p, {
          headers: { "user-agent": "tpj-revalidate-warm" },
          signal: AbortSignal.timeout(20000),
        })
          .then((r) => r.arrayBuffer())
          .catch(() => {});
      }
    };
    await Promise.all([visit(), visit()]);
  });

  return Response.json({ ok: true, revalidated: mapped });
}
