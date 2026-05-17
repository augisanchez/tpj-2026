# CDN Setup From Zero

A from-scratch walkthrough for setting up Cloudflare Image Resizing for
`thephotographicjournal.com`. Assumes nothing exists yet: no Cloudflare
account, no zone added, no records anywhere. Read alongside
`IMAGE_STRATEGY.md`, which covers the architecture and rollback plan.

Total active time about 30 minutes, plus a propagation wait of 15
minutes to 24 hours in the middle where you can't act.

## What you'll need handy before you start

- Login for whoever sold you `thephotographicjournal.com` (Namecheap,
  GoDaddy, Google Domains, Hover, etc.)
- A credit card. Cloudflare's Image Resizing requires a paid plan.
- Vercel project access for `tpj-2026`.

## Step 1: Inventory your current DNS records (5 min, before touching anything)

This is the single most important pre-flight check. Changing
nameservers to Cloudflare in Step 5 moves all DNS for the domain. If
anything is missing when Cloudflare takes over, that thing breaks.
Email goes silent. WP goes dark.

- Log in to your registrar's DNS panel for `thephotographicjournal.com`.
- Screenshot or copy-paste every record. You're mainly looking for:
  - `A` records (the apex, `www`, anything else)
  - `MX` records (email routing — critical)
  - `TXT` records (often SPF, DKIM, DMARC for email auth; site
    verifications)
  - `CNAME` records
- Save the screenshot somewhere you can reference in 30 minutes.

Cloudflare's import in Step 3 catches most of this automatically, but
it sometimes misses niche TXT records. Have the canonical list in your
back pocket either way.

## Step 2: Create the Cloudflare account (3 min)

- Go to `https://dash.cloudflare.com/sign-up`
- Sign up with the email you want to own this account long-term. Not a
  one-off; this is the root of trust for all Cloudflare-fronted services.
- Cloudflare 2FA is on by default. Use an authenticator app, not SMS.

## Step 3: Add `thephotographicjournal.com` as a zone (5 min)

- Cloudflare dashboard → "Add a site" (top right).
- Enter `thephotographicjournal.com`. No `www`, no `https://`.
- Cloudflare scans your existing DNS and imports records.

**Before clicking Continue:** compare the imported records against your
Step 1 inventory. Anything missing, add it manually. Pay particular
attention to MX and TXT records related to email.

For the records you imported, check the proxy status column (orange
cloud vs gray cloud):

- **Apex (`@`) and `www`** pointing at your WP host: **gray cloud** for
  now. We're not proxying the WP origin in Phase A; we're only proxying
  the new `media` subdomain (added in Step 8). Proxying the apex now
  would change SSL behavior and could break the existing site.
- **MX records:** Cloudflare doesn't proxy mail, so these stay as-is.

If anything looks wrong here, stop and figure it out before continuing.
This is the recoverable point.

## Step 4: Choose a plan (decision point, 3 min)

Cloudflare's image transformation product line has shifted multiple
times in recent years. At sign-up you'll see two relevant options:

- **Image Resizing**, available on the Pro plan ($20/mo) and above.
  URL shape: `https://<zone>/cdn-cgi/image/<params>/<path>`. This is
  what the code in `lib/cdn.ts` builds.
- **Cloudflare Images** (separate product, any plan, per-image
  pricing). URL shape: `https://imagedelivery.net/...`. Would require
  a refactor of `lib/cdn.ts`.

**Recommended:** subscribe to Pro and use Image Resizing. The code is
already written for it, monthly cost lands around $20–35 depending on
traffic, and you get other Pro features (WAF rules, faster purges)
as a bonus.

Verify the current product naming on `https://www.cloudflare.com/plans/`
before committing. If the URL shape we coded against isn't available
under that name anymore, stop and surface that finding before continuing
so the code path can be revisited.

To upgrade: dashboard → your zone → Plans (left sidebar) → Pro →
Subscribe. Credit card here.

## Step 5: Change nameservers at your registrar (5–10 min)

After Step 3, Cloudflare gives you two nameservers that look like
`xxx.ns.cloudflare.com` and `yyy.ns.cloudflare.com`. Copy them.

Then in your registrar:

- **Namecheap:** Domain List → Manage → Nameservers → "Custom DNS" →
  paste the two NS values.
- **GoDaddy:** My Products → DNS → Nameservers → "Change" → "Enter my
  own nameservers (advanced)".
- **Google Domains** (now Squarespace Domains): Domain → DNS → Custom
  name servers.
- **Hover / Porkbun / Cloudflare Registrar:** similar pattern, look
  for "Nameservers."

Save the change. The site doesn't go down at this point. DNS
propagation is gradual; the old nameservers keep answering until each
resolver's cache expires.

## Step 6: Wait for activation (15 min to 24 hr)

Cloudflare dashboard → your zone → Overview tab shows status. It will
switch from "Pending Nameserver Update" to "Active" once propagation
completes. You'll also get a confirmation email.

What you can do while waiting:

- Open Vercel and locate the `tpj-2026` project's Environment
  Variables page (Step 10 prep).
- Pick a test image URL for Step 9. From the DB audit, this one
  exists: `https://thephotographicjournal.com/wp-content/uploads/2026/05/Marie.jpg`

## Step 7: Enable Image Resizing (2 min, once Cloudflare is Active)

- Cloudflare dashboard → your zone → **Speed** (left sidebar) →
  **Optimization** → scroll to **Image Resizing** → toggle **On**.
- If the toggle is grayed out, you're on Free plan; finish Step 4 first.

## Step 8: Add the `media` subdomain (2 min)

- Cloudflare → DNS → Records → Add record:
  - Type: `CNAME`
  - Name: `media`
  - Target: `thephotographicjournal.com`
  - Proxy status: **Proxied (orange cloud)** ← required, this is what
    enables image transforms
  - TTL: Auto
- Save.

## Step 9: Smoke-test from your terminal (1 min)

```bash
curl -I "https://media.thephotographicjournal.com/cdn-cgi/image/width=800,quality=85,format=auto/wp-content/uploads/2026/05/Marie.jpg"
```

Look for:

- `HTTP/2 200`
- `content-type: image/webp` (or `image/avif` from a modern browser;
  curl will show what Cloudflare picks for curl's UA)
- A `cf-resized:` header

Common failure modes:

- **404:** the CNAME target is wrong, or the path doesn't exist on
  origin. Try `curl -I https://thephotographicjournal.com/wp-content/uploads/2026/05/Marie.jpg`
  directly. If that's also 404, the underlying image isn't where you
  think.
- **415 Unsupported Media Type / 403:** Image Resizing isn't actually
  enabled. Re-check Step 7.
- **526 Invalid SSL Certificate:** Cloudflare can't reach the origin
  via HTTPS. In Cloudflare → SSL/TLS → Overview, set the encryption
  mode to **Full** (not Full strict) for now.

## Step 10: Set `NEXT_PUBLIC_CDN_BASE` in Vercel (3 min)

- Vercel dashboard → tpj-2026 project → Settings → Environment Variables.
- Add:
  - Key: `NEXT_PUBLIC_CDN_BASE`
  - Value: `https://media.thephotographicjournal.com`
  - Environments: tick all three (Production, Preview, Development).
- Save.
- Trigger a redeploy: either push any small commit, or open the latest
  deployment and click "Redeploy."

## Step 11: Validate on the live site (5 min)

- Open a deployed article page.
- View source. Find a hero image. Confirm `srcset` references
  `media.thephotographicjournal.com/cdn-cgi/image/...`.
- Find an article-body `<img>` inside the prose. Same treatment, plus
  `loading="lazy"`.
- Open DevTools Network → reload → click any image request. `Type`
  column should say `webp`.
- Run PageSpeed Insights on the article URL. LCP should drop visibly
  from your previous baseline; "Properly size images" and "Serve images
  in next-gen formats" should clear.

## Rollback at any point

- **Phase A is config-only.** To revert: in Vercel, remove
  `NEXT_PUBLIC_CDN_BASE` and redeploy. Frontend reverts to plain origin
  URLs instantly. DNS changes from Steps 5 and 8 can stay; they're
  harmless.
- **To revert the DNS migration entirely (Step 5):** set the
  nameservers back at the registrar. Takes another propagation cycle.

## What to watch for the first 24 hours after Step 10

- **Origin load on `thephotographicjournal.com`.** Cold cache misses
  pull through the WP host. If that host is undersized or rate-limited,
  the first few hours will feel it briefly until Cloudflare warms its
  edge cache.
- **Any specific image returning 404 through the CDN.** If you find
  one, capture the failing URL — the rewriter likely needs another URL
  shape added to `rewriteMediaUrl` in `frontend/lib/media.ts`.
