/**
 * Form relay with Cloudflare Turnstile (audit L7). Used only when the
 * Turnstile keys are configured; otherwise forms post straight to Basin
 * as before. Verifies the Turnstile token server-side, repeats the
 * required-field checks, then forwards the submission to Basin.
 */
const TARGETS: Record<string, string | undefined> = {
  contact: process.env.NEXT_PUBLIC_BASIN_CONTACT_ENDPOINT,
  submit: process.env.NEXT_PUBLIC_BASIN_ENDPOINT,
};
const REQUIRED: Record<string, string[]> = {
  contact: ["Name", "Email", "Message"],
  submit: ["Name", "Email"],
};

export async function POST(request: Request) {
  const form = new URL(request.url).searchParams.get("form") ?? "";
  const target = TARGETS[form];
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!target || !secret) return Response.json({ error: "unavailable" }, { status: 404 });

  const body = await request.formData();
  const token = String(body.get("cf-turnstile-response") ?? "");
  const verify = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({
      secret,
      response: token,
      remoteip: request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0] ?? "",
    }),
  }).then((r) => r.json()).catch(() => ({ success: false }));
  if (!verify.success) return Response.json({ error: "verification" }, { status: 403 });

  for (const field of REQUIRED[form] ?? []) {
    if (!String(body.get(field) ?? "").trim()) return Response.json({ error: `missing ${field}` }, { status: 400 });
  }
  const email = String(body.get("Email") ?? "");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "email" }, { status: 400 });

  body.delete("cf-turnstile-response");
  const res = await fetch(target, { method: "POST", headers: { Accept: "application/json" }, body });
  return Response.json({ ok: res.ok }, { status: res.ok ? 200 : 502 });
}
