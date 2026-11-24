"use client";

import Script from "next/script";

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

/** Cloudflare Turnstile widget. Renders nothing until a site key is set.
 *  It adds a hidden cf-turnstile-response field to the enclosing form. */
export function Turnstile() {
  if (!TURNSTILE_SITE_KEY) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="lazyOnload" />
      <div className="cf-turnstile" data-sitekey={TURNSTILE_SITE_KEY} data-theme="light" />
    </>
  );
}
