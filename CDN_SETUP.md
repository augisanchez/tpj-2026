# TPJ CDN Setup — Full Walkthrough

End-to-end guide for setting up Cloudflare in front of the S3 media
bucket. Six phases: gather information, create the Cloudflare account,
stage everything on a non-production subdomain, test from local dev,
cut over to production, then validate and decommission staging.

Read alongside `IMAGE_STRATEGY.md`, which covers the architecture
rationale and the longer-term R2 migration.

## Why this matters

Today: visitor's browser asks `thephotographicjournal.com` for an image
→ WPEngine receives the request → WPEngine fetches from S3 over its
internal network → WPEngine sends the image to the browser. WPEngine
counts that as bandwidth on your plan. You're paying them to be a
passthrough for files that live on S3.

After this cutover: visitor's browser asks `media.thephotographicjournal.com`
for an image → Cloudflare receives the request → Cloudflare fetches
from S3 (origin pull) and caches at the edge → Cloudflare sends to
browser. WPEngine never touches image traffic. Bandwidth on your WP
host drops to near zero.

Total active time about 60 minutes, plus a propagation wait of 15
minutes to 24 hours when changing nameservers.

## Architecture

```
Phase 1 (current):
visitor → thephotographicjournal.com (WPEngine) → S3 → WPEngine → visitor
                                  ^                            ^
                              (egress billed by WPEngine)

After this guide (staging):
local dev → media-staging.thephotographicjournal.com → Cloudflare → S3 → Cloudflare → local dev
                                                            ^
                                                  (cached at Cloudflare edge)

After production cutover:
visitor → media.thephotographicjournal.com → Cloudflare → S3 → Cloudflare → visitor
visitor → thephotographicjournal.com (Vercel) → static page
                                  ^
                          (WPEngine no longer in path)
```

# Phase 1: Gather information

You can't begin the technical work until you have these pieces.

## 1.1 — S3 bucket details (5 min)

Log into WP admin → Settings → "Offload Media" (or "WP Offload Media"
under Media menu, depending on plugin version). Capture:

1. **Bucket name** (something like `tpj-uploads`, `thephotographicjournal-media`).
2. **AWS region** (e.g., `us-east-1`, `us-west-2`, `eu-west-1`).
3. **URL format**: virtual-hosted-style (`<bucket>.s3.<region>.amazonaws.com`)
   or path-style (`s3.<region>.amazonaws.com/<bucket>`). The settings
   page usually shows the current public URL for an asset.
4. **WP Offload Media tier**: Lite (free) or Pro (paid). The status
   appears in the plugin header. Lite is fine for our setup.

Confirm public read access from your terminal:

```bash
curl -I "https://<bucket>.s3.<region>.amazonaws.com/wp-content/uploads/2026/05/Marie.jpg"
```

- `200 OK` means the bucket allows public reads. Good, proceed.
- `403 Forbidden` means the bucket is private. We'll add a Cloudflare-only
  bucket policy in Phase 3. Note this and continue.

## 1.2 — DNS inventory at the registrar (5 min)

Log into whoever sold you `thephotographicjournal.com` (Namecheap,
GoDaddy, Google Domains, Hover, etc.). Screenshot every DNS record.
You're looking for:

- `A` records (apex `@`, `www`, anything else)
- `MX` records (email — critical, don't lose these)
- `TXT` records (SPF, DKIM, DMARC, site verifications)
- Existing `CNAME` records

Save the screenshot. Cloudflare imports most of this automatically in
Phase 2, but you want a canonical list in your back pocket in case
anything is missed.

## 1.3 — Account and access checklist

Confirm you have or can create:

- A Cloudflare account (or the willingness to make one in Phase 2).
- A credit card for Cloudflare Pro ($20/mo). Image Resizing requires Pro.
- AWS Console access to the S3 bucket (for the optional Phase 3 bucket
  policy edit, if your bucket is private).
- Vercel project access for `tpj-2026` (for Phase 5 env vars).
- Registrar login for the nameserver change in Phase 2.

# Phase 2: Cloudflare account and zone

## 2.1 — Create the account (3 min, skip if you already have one)

- Go to `https://dash.cloudflare.com/sign-up`
- Sign up with an email you want to own long-term. This account is the
  root of trust for all Cloudflare-fronted services.
- Enable 2FA via authenticator app, not SMS. Cloudflare prompts you on
  first login.

## 2.2 — Add `thephotographicjournal.com` as a zone (5 min)

- Cloudflare dashboard → "Add a site" (top right).
- Enter `thephotographicjournal.com`. No `www`, no `https://`.
- Cloudflare scans your existing DNS and imports records.

**Before clicking Continue:** compare imported records against your
Phase 1.2 screenshot. Anything missing, add manually. Particularly
MX and TXT records related to email.

For imported records, check the proxy status column (orange vs gray
cloud):

- **Apex `@` and `www`** pointing at WPEngine: **gray cloud** for now.
  We are not proxying the WP origin during staging. We only proxy the
  new `media-staging` and (later) `media` subdomains.
- **MX records:** Cloudflare doesn't proxy mail, so these stay as-is.

If anything looks off, stop and fix it. This is the recoverable point.

## 2.3 — Upgrade to Pro plan (3 min)

- Dashboard → your zone → Plans (left sidebar) → Pro → Subscribe.
- Credit card here. $20/mo flat.

Pro is required for Image Resizing. Without it, the `/cdn-cgi/image/...`
URL transforms won't work, and the entire frontend image pipeline we
shipped expects them.

(Verify the current plan tier on `https://www.cloudflare.com/plans/`
before subscribing. Cloudflare has moved Image Resizing between plans
in recent years. If the feature has moved to a different tier or
product name, surface that finding before continuing so we can plan
around it.)

## 2.4 — Change nameservers at your registrar (5 min)

After 2.2 Cloudflare gives you two nameservers (`xxx.ns.cloudflare.com`
and `yyy.ns.cloudflare.com`). Copy them.

In your registrar:

- **Namecheap:** Domain List → Manage → Nameservers → "Custom DNS" →
  paste the two NS values.
- **GoDaddy:** My Products → DNS → Nameservers → "Change" → "Enter my
  own nameservers (advanced)".
- **Google Domains** (now Squarespace Domains): Domain → DNS → Custom
  name servers.
- **Hover / Porkbun / Cloudflare Registrar:** similar pattern, look
  for "Nameservers."

Save. **The site doesn't go down here.** DNS propagation is gradual;
old nameservers keep answering until each resolver's cache expires.

## 2.5 — Wait for activation (15 min to 24 hr)

Cloudflare → your zone → Overview tab. Status changes from "Pending
Nameserver Update" to "Active" when propagation completes. You also
get a confirmation email.

While you wait:

- Pre-stage `frontend/.env.local` and the Vercel env vars page for
  Phase 4 and 5.
- Pick a test image URL with the bucket info from Phase 1.1.

## 2.6 — Enable Image Resizing (2 min, once Active)

- Dashboard → your zone → **Speed** → **Optimization** → **Image
  Resizing** → toggle **On**.
- Grayed out? You're still on Free — recheck 2.3.

# Phase 3: Stage the CDN on `media-staging`

This phase sets up the entire image pipeline on a parallel subdomain
that no production traffic uses. Visitors continue to hit WPEngine for
images. Local dev hits the new pipeline. Risk-free.

## 3.1 — Add the staging CNAME (2 min)

- Cloudflare → DNS → Records → Add record:
  - Type: `CNAME`
  - Name: `media-staging`
  - Target: `<bucket>.s3.<region>.amazonaws.com` (virtual-hosted-style).
    Example: `tpj-uploads.s3.us-east-1.amazonaws.com`. Use the values
    from Phase 1.1.
  - Proxy status: **Proxied (orange cloud)** — required, this is what
    enables image transforms.
  - TTL: Auto.
- Save.

## 3.2 — Override the Host header for the S3 origin (2 min)

S3 routes requests based on the `Host` header. Cloudflare by default
sends `Host: media-staging.thephotographicjournal.com`, which S3
doesn't recognize. We override.

- Cloudflare → Rules → Origin Rules → Create rule.
- Name: `S3 origin host override (staging)`
- Match: Hostname **equals** `media-staging.thephotographicjournal.com`
- Action: Rewrite to → Host Header → Static value: `<bucket>.s3.<region>.amazonaws.com`
- Deploy.

## 3.3 — Set SSL mode to Full (1 min)

- Cloudflare → SSL/TLS → Overview → encryption mode → **Full** (not
  Full strict).
- Full strict requires the origin's cert to match our subdomain, which
  S3 won't. Full validates that there is a cert without enforcing the
  hostname match.

## 3.4 — (If bucket is private) add a bucket policy (3 min)

Skip this if `curl -I` returned 200 in Phase 1.1.

If the bucket is private, S3 returns 403 to Cloudflare's origin pulls.
We open just enough to let Cloudflare pull:

- AWS Console → S3 → your bucket → Permissions → Bucket policy → Edit.
- Add a statement allowing GETs from Cloudflare's IP ranges
  (`https://www.cloudflare.com/ips/`). Example skeleton:

  ```json
  {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Sid": "AllowCloudflareReads",
        "Effect": "Allow",
        "Principal": "*",
        "Action": "s3:GetObject",
        "Resource": "arn:aws:s3:::<bucket>/*",
        "Condition": {
          "IpAddress": {
            "aws:SourceIp": [
              "173.245.48.0/20",
              "103.21.244.0/22",
              "..."
            ]
          }
        }
      }
    ]
  }
  ```

Cloudflare publishes the full IP list. Maintaining it manually is a
chore; the alternative is a Cloudflare Worker that proxies signed S3
URLs, which is more code. Public bucket reads are the simpler path
if your editorial doesn't include sensitive unpublished material in
the bucket.

## 3.5 — Smoke-test the direct S3 pull through Cloudflare (1 min)

```bash
curl -I "https://media-staging.thephotographicjournal.com/wp-content/uploads/2026/05/Marie.jpg"
```

Look for:

- `HTTP/2 200`
- `content-type: image/jpeg` (or whatever the source is)
- `cf-cache-status: MISS` on the first request, `HIT` on the next.

Failure modes:

- `404`: Origin Rule isn't matching, or bucket key path doesn't include
  `wp-content/uploads/`. Check WP Offload Media's "Bucket subdirectory"
  setting — some installs prefix all keys with an extra path.
- `403`: Bucket policy. Re-check 3.4.
- `526`: SSL mode is Full strict. Drop to Full per 3.3.
- `521`: Origin Rule overrode the Host but S3 still rejected. Re-check
  the bucket name + region in the override target.

## 3.6 — Smoke-test the transform (1 min)

```bash
curl -I "https://media-staging.thephotographicjournal.com/cdn-cgi/image/width=800,quality=85,format=auto/wp-content/uploads/2026/05/Marie.jpg"
```

Look for:

- `HTTP/2 200`
- `content-type: image/webp` (Cloudflare picks based on Accept header;
  curl's UA gets WebP)
- `cf-resized:` header confirms the transform pipeline ran

Failure modes:

- `415 Unsupported Media Type`: Image Resizing not actually enabled.
  Recheck 2.6.
- `403`: Same as above (bucket policy).

# Phase 4: Test against staging from local dev

The CDN now works at `media-staging.thephotographicjournal.com`.
Wire it into local dev to validate the frontend code paths.

## 4.1 — Update `.env.local` (1 min)

Add (or update) `frontend/.env.local`:

```
NEXT_PUBLIC_CDN_BASE=https://media-staging.thephotographicjournal.com
```

Keep `WORDPRESS_API_URL=http://tpj.local/graphql` as-is; we're only
changing image delivery, not data fetching.

## 4.2 — Run the dev server and verify (5 min)

```bash
cd frontend && npm run dev
```

Open `http://localhost:3000` and walk through:

1. **Homepage hero.** View source on the carousel image. `srcset`
   entries should reference `media-staging.thephotographicjournal.com/cdn-cgi/image/width=…`.
2. **An article page.** View source on the hero. Same pattern. Then
   scroll into the body and inspect an inline image — the article-body
   rewriter should have injected `srcset`, `sizes`, and `loading="lazy"`.
3. **DevTools Network tab, reload, click any image request.** Type
   column should say `webp`. Initiator/origin should be the staging
   subdomain.
4. **Theme thumbnails on the themes index and homepage Dive Deeper.**
   Composite 2x2 thumbnails — each individual image should route
   through the staging CDN.
5. **PhotographerAvatar.** Open a photographer profile page; the
   portrait should load through the CDN.
6. **404 background.** Hit a non-existent URL like
   `http://localhost:3000/this-does-not-exist`. The random essay hero
   in the 404 background should also route through staging.

If any image fails to load: open DevTools, copy the failing URL,
and check the response status. Most common cause: the URL path
contains a legacy host that `rewriteMediaUrl` doesn't normalize,
falling through to a direct origin request. Tell me the URL and
we'll add the case to `lib/media.ts`.

## 4.3 — Run Lighthouse against a local article (2 min)

DevTools → Lighthouse → Performance → analyze.

Compare against `http://localhost:3000/<same-route>` without
`NEXT_PUBLIC_CDN_BASE` set. The CDN version should drop "Properly
size images" and "Serve images in next-gen formats" warnings.
LCP often drops 30–60% on image-heavy article pages.

## 4.4 — Validate WPEngine traffic stays flat (next 24 hr)

While in this phase, **no production traffic uses the staging CDN.**
Only your local browser does. WPEngine's bandwidth chart shouldn't
move because no public visitors are bypassing it yet. That's
expected; we're proving the path, not redirecting traffic.

# Phase 5: Production cutover

Staging works. Time to move the live site over.

## 5.1 — Add the production CNAME (2 min)

- Cloudflare → DNS → Add record:
  - Type: `CNAME`
  - Name: `media`
  - Target: same as staging (`<bucket>.s3.<region>.amazonaws.com`).
  - Proxy status: **Proxied (orange cloud)**.

## 5.2 — Add the production Origin Rule (2 min)

Same as 3.2 but for the `media` hostname:

- Cloudflare → Rules → Origin Rules → Create rule.
- Name: `S3 origin host override (production)`
- Match: Hostname **equals** `media.thephotographicjournal.com`
- Action: Rewrite to → Host Header → Static value: `<bucket>.s3.<region>.amazonaws.com`
- Deploy.

## 5.3 — Smoke-test production CDN URL (1 min)

```bash
curl -I "https://media.thephotographicjournal.com/cdn-cgi/image/width=800,quality=85,format=auto/wp-content/uploads/2026/05/Marie.jpg"
```

Same expected response as 3.6. If anything differs, you're on a
different config path between staging and prod; compare the two
Origin Rules side by side.

## 5.4 — Set `NEXT_PUBLIC_CDN_BASE` in Vercel (3 min)

- Vercel → tpj-2026 → Settings → Environment Variables → Add:
  - Key: `NEXT_PUBLIC_CDN_BASE`
  - Value: `https://media.thephotographicjournal.com`
  - Environments: Production, Preview, Development (all three).
- Save.
- Trigger a redeploy: push any small commit, or click "Redeploy" on
  the latest deployment.

(If you haven't set up Vercel yet, that's a separate prerequisite —
see `VERCEL_SETUP.md` if it exists, otherwise we'll write it.)

## 5.5 — Validate on the live site (5 min)

Open a deployed article on the live Vercel URL:

- View source. Hero image's `srcset` should reference
  `media.thephotographicjournal.com/cdn-cgi/image/...`.
- View source on an inline article-body image. Same plus
  `loading="lazy"`.
- DevTools Network → reload → image request returns `webp`.
- Run PageSpeed Insights on the URL. LCP should drop notably.

# Phase 6: Decommission staging and watch costs

## 6.1 — (Optional) Remove the staging CNAME (1 min)

Once production is validated and stable for a few days:

- Cloudflare DNS → delete the `media-staging` CNAME and its Origin Rule.

Keeping staging around is fine if you want to test future changes
against the CDN without touching production. It costs nothing extra.

## 6.2 — Watch WPEngine bandwidth (next billing cycle)

Open `my.wpengine.com` → your install → Plan Overview. Bandwidth
should drop dramatically within hours of the production cutover.
Expected: from 135 GB/month down to 5–15 GB/month.

Once you have 2–4 weeks of clean low-bandwidth data:

- Plan: Modify → downgrade to Startup tier (or whatever sits below
  your current Professional).
- Or, if WPEngine still hounds despite the drop, migrate to
  Cloudways. See the hosting decision notes in
  `project_tpj_v2_deferred_work.md`.

# Rollback at any point

| Phase | How to revert |
|---|---|
| 2.4 (nameservers) | Set the registrar's nameservers back to the old values. Propagation cycle again. |
| 3.1 (staging CNAME) | Delete the record. No production impact. |
| 5.1 (prod CNAME) | Delete the record. Frontend reverts to plain origin URLs once Vercel env var is also unset. |
| 5.4 (Vercel env) | Delete `NEXT_PUBLIC_CDN_BASE` in Vercel, redeploy. Frontend reverts instantly to plain origin URLs. |

The two-layer gate (Cloudflare CNAME + Vercel env var) means you can
roll back from either side independently.

# Troubleshooting reference

Common failures and fixes:

| Symptom | Likely cause | Fix |
|---|---|---|
| `curl` returns 404 | Bucket key path doesn't include `wp-content/uploads/` | Check WP Offload Media's "Bucket subdirectory" setting |
| `curl` returns 403 | S3 bucket is private | Add Cloudflare-IP-restricted policy (Phase 3.4) |
| `curl` returns 415 | Image Resizing isn't enabled | Recheck Phase 2.6 |
| `curl` returns 521 | Cloudflare can't reach S3 | Verify Origin Rule host override target |
| `curl` returns 526 | SSL mode is Full (strict) | Drop to Full (Phase 3.3) |
| Browser images load but skip CDN | `lib/media.ts` doesn't recognize the source URL | Capture failing URL and add a branch to `rewriteMediaUrl` |
| Images load but stay JPEG | Browser doesn't accept WebP, or `format=auto` was overridden | Inspect request headers; confirm `Accept: image/webp` is present |

# What changes about the bandwidth bill

The whole point. Before this cutover, WPEngine sees image bandwidth.
After this cutover, WPEngine sees only admin sessions plus Vercel
revalidation queries. Expected drop:

| Metric | Before | After |
|---|---|---|
| WPEngine bandwidth | ~135 GB/month | ~5–15 GB/month |
| WPEngine visit count | ~8.5k/month | ~500–2k/month (admin + ISR) |
| Cloudflare requests | 0 | (every image, edge-cached) |
| Cloudflare Image Resizing transforms | 0 | ~3–10k unique combos/month |

Cloudflare cost: $20/mo Pro + $0.50 per 1k unique transforms.
Realistic monthly bill: $22–28.

WPEngine downgrade from Professional ($65/mo) to Startup (~$25/mo)
saves $40/mo on the WP side. Net savings after Cloudflare: roughly
$18/mo, or $216/year. The bigger win is removing the bandwidth
ceiling and the renewal pressure tied to it.
