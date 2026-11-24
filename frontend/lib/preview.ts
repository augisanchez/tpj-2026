import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies, draftMode } from "next/headers";

/**
 * Draft preview, scoped to one article.
 *
 * WordPress signs `type|id|status|exp` (inc/editor-experience.php →
 * tpj_preview_url). /api/preview checks that signature, turns on draft
 * mode and stores the signed fields in an httpOnly cookie. Every
 * article render re-checks the cookie and only unlocks the exact
 * type + id it was signed for, so one preview link can't open other
 * drafts.
 */

export const PREVIEW_COOKIE = "tpj_preview";
export const PREVIEW_TYPES = new Set(["essay", "interview", "feature"]);

export type SignedPreview = {
  type: string;
  id: number;
  status: "draft" | "publish";
  exp: number;
};

export type PreviewTarget = { id: number; asPreview: boolean };

/** Verify signed fields. Returns them on a valid, unexpired signature. */
export function verifyPreview(
  type: string,
  id: string,
  status: string,
  exp: string | number,
  sig: string,
): SignedPreview | undefined {
  const secret = process.env.TPJ_PREVIEW_SECRET;
  const expNum = Number(exp);
  if (!secret || !PREVIEW_TYPES.has(type) || !/^\d+$/.test(id)) return undefined;
  if (status !== "draft" && status !== "publish") return undefined;
  if (!Number.isFinite(expNum) || expNum < Date.now() / 1000) return undefined;
  const expected = Buffer.from(
    createHmac("sha256", secret).update(`${type}|${id}|${status}|${expNum}`).digest("hex"),
  );
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return undefined;
  return { type, id: Number(id), status, exp: expNum };
}

export function encodePreviewCookie(p: SignedPreview, sig: string) {
  return [p.type, p.id, p.status, p.exp, sig].join("|");
}

/**
 * The preview to render for `type` + `slug`, or undefined. Needs draft
 * mode on, a valid signed cookie, and the cookie's type, id and status
 * to match the `preview-<id>` / `preview-<id>-p` slug.
 */
export async function previewTarget(type: string, slug: string): Promise<PreviewTarget | undefined> {
  const m = /^preview-(\d+)(-p)?$/.exec(slug);
  if (!m) return undefined;
  const { isEnabled } = await draftMode();
  if (!isEnabled) return undefined;
  const raw = (await cookies()).get(PREVIEW_COOKIE)?.value;
  if (!raw) return undefined;
  const parts = raw.split("|");
  if (parts.length !== 5) return undefined;
  const signed = verifyPreview(parts[0], parts[1], parts[2], parts[3], parts[4]);
  if (!signed) return undefined;
  const asPreview = Boolean(m[2]);
  if (signed.type !== type || signed.id !== Number(m[1])) return undefined;
  if ((signed.status === "publish") !== asPreview) return undefined;
  return { id: signed.id, asPreview };
}
