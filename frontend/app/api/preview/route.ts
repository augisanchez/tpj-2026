import { cookies, draftMode } from "next/headers";
import { redirect } from "next/navigation";
import { encodePreviewCookie, PREVIEW_COOKIE, verifyPreview } from "@/lib/preview";

/**
 * WordPress's Preview button lands here with a signed, expiring link.
 * On a valid signature we turn on draft mode, store the signed fields
 * (scoping the preview to this one article, see lib/preview.ts) and
 * open the article at preview-<id>.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const sig = q.get("sig") ?? "";
  const signed = verifyPreview(
    q.get("type") ?? "",
    q.get("id") ?? "",
    q.get("status") === "publish" ? "publish" : "draft",
    q.get("exp") ?? "",
    sig,
  );
  if (!signed) {
    return new Response("Preview link invalid or expired. Use Preview in WordPress again.", { status: 401 });
  }

  (await draftMode()).enable();
  (await cookies()).set(PREVIEW_COOKIE, encodePreviewCookie(signed, sig), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.max(1, Math.floor(signed.exp - Date.now() / 1000)),
  });
  redirect(`/${signed.type}/preview-${signed.id}${signed.status === "publish" ? "-p" : ""}`);
}
