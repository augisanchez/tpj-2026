import { createHmac, timingSafeEqual } from "node:crypto";
import { draftMode } from "next/headers";
import { redirect } from "next/navigation";

const TYPES = new Set(["essay", "interview", "feature"]);

/**
 * WordPress's Preview button lands here with a signed, expiring link
 * (inc/editor-experience.php → tpj_preview_url). On a valid signature
 * we turn on draft mode and open the article at preview-<id>.
 */
export async function GET(req: Request) {
  const secret = process.env.TPJ_PREVIEW_SECRET;
  const q = new URL(req.url).searchParams;
  const type = q.get("type") ?? "";
  const id = q.get("id") ?? "";
  const status = q.get("status") === "publish" ? "publish" : "draft";
  const exp = Number(q.get("exp") ?? 0);
  const sig = q.get("sig") ?? "";

  if (!secret || !TYPES.has(type) || !/^\d+$/.test(id) || !exp || exp < Date.now() / 1000) {
    return new Response("Preview link invalid or expired. Use Preview in WordPress again.", { status: 401 });
  }
  const expected = createHmac("sha256", secret).update(`${type}|${id}|${status}|${exp}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return new Response("Preview link invalid or expired. Use Preview in WordPress again.", { status: 401 });
  }

  (await draftMode()).enable();
  redirect(`/${type}/preview-${id}${status === "publish" ? "-p" : ""}`);
}
