import { revalidatePath } from "next/cache";

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
  for (const p of paths) revalidatePath(p);
  return Response.json({ ok: true, revalidated: paths });
}
